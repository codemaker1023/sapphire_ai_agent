# core/code_validator.py
# AST validation for untrusted Python code (toolmaker + unsigned plugins in managed mode)

import ast
import os
import logging

logger = logging.getLogger(__name__)

# Always blocked in strict + moderate — dangerous operations
BLOCKED_IMPORTS = {
    'shutil', 'ctypes', 'multiprocessing',
    'socket', 'signal', 'importlib',
}

# Blocked in strict only — moderate unlocks these
STRICT_BLOCKED_IMPORTS = {'subprocess'}

BLOCKED_CALLS = {
    'eval', 'exec', '__import__', 'compile',
    'globals', 'locals', 'getattr', 'setattr', 'delattr', 'open',
}

BLOCKED_ATTRS = {
    ('os', 'system'), ('os', 'popen'), ('os', 'exec'), ('os', 'execv'),
    ('os', 'execvp'), ('os', 'execvpe'), ('os', 'spawn'), ('os', 'spawnl'),
    ('os', 'remove'), ('os', 'unlink'), ('os', 'rmdir'), ('os', 'removedirs'),
    ('os', 'rename'), ('os', 'kill'), ('os', 'environ'),
}

# Additional blocks in managed/Docker mode
MANAGED_BLOCKED_IMPORTS = {'pathlib', 'io', 'tempfile', 'glob'}

MANAGED_BLOCKED_ATTRS = {
    ('os', 'getenv'), ('os', 'listdir'), ('os', 'scandir'), ('os', 'walk'),
    ('os', 'path'), ('os', 'getcwd'), ('os', 'stat'), ('os', 'lstat'),
    ('os', 'read'), ('os', 'open'), ('os', 'makedirs'), ('os', 'mkdir'),
    ('os', 'readlink'), ('os', 'access'), ('os', 'fspath'),
}

# Strict mode allowlist — covers HTTP clients, data processing, crypto, text, math
ALLOWED_STRICT = {
    # HTTP & data interchange
    'requests', 'urllib', 'urllib3', 'http', 'ssl', 'json', 'xml', 'html', 'csv', 'base64',
    # LLM SDKs (no more dangerous than requests — user provides keys via settings)
    'openai', 'anthropic',
    # Text & pattern processing
    're', 'string', 'textwrap', 'difflib', 'unicodedata', 'codecs', 'fnmatch',
    # Date, time, math
    'datetime', 'zoneinfo', 'calendar', 'time',
    'math', 'cmath', 'decimal', 'fractions', 'numbers', 'statistics', 'random',
    # Data structures & functional
    'collections', 'itertools', 'functools', 'operator', 'copy',
    'bisect', 'heapq',
    # Crypto & encoding
    'hashlib', 'hmac', 'secrets', 'binascii', 'struct',
    # Compression (pure data transform)
    'gzip', 'zlib',
    # Type system & boilerplate
    'typing', 'enum', 'dataclasses', 'abc',
    # Misc safe stdlib
    'uuid', 'logging', 'pprint', 'contextlib',
    'traceback', 'warnings', 'weakref', 'ipaddress',
    'platform', 'locale',
    # Data processing & media (installed via requirements)
    'numpy', 'PIL', 'bs4', 'pypdf', 'tiktoken', 'croniter',
    # Allowed but managed-blocked (belt + suspenders)
    'os', 'io', 'pathlib',
}


def is_managed():
    from core.settings_manager import settings
    return settings.is_managed()


def validate_code(code, strictness='strict'):
    """Validate Python source code via AST.

    Args:
        code: Python source string
        strictness: 'strict' (allowlist), 'moderate' (blocklist + subprocess),
                    or 'system_killer' (syntax only — no restrictions)

    Returns:
        (ok: bool, error_msg: str)
    """
    if strictness == 'system_killer':
        try:
            ast.parse(code)
            return True, ""
        except SyntaxError as e:
            return False, f"Syntax error: {e}"

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Syntax error: {e}"

    blocked_imports = BLOCKED_IMPORTS
    blocked_attrs = BLOCKED_ATTRS
    if strictness == 'strict':
        blocked_imports = blocked_imports | STRICT_BLOCKED_IMPORTS
    if is_managed():
        blocked_imports = blocked_imports | MANAGED_BLOCKED_IMPORTS
        blocked_attrs = blocked_attrs | MANAGED_BLOCKED_ATTRS

    # Track aliases: if someone writes `x = os`, then `x` is an alias for `os`
    # Also track `from X import Y` aliases and blocked call aliases
    aliases = {}  # name -> original module/blocked name
    blocked_names = set(BLOCKED_CALLS)

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                mod = alias.name.split('.')[0]
                if mod in blocked_imports:
                    return False, f"Blocked import: {mod}"
                if strictness == 'strict' and mod not in ALLOWED_STRICT:
                    return False, f"Import '{mod}' not in allowlist"
                # Track import aliases: `import os as o` -> aliases['o'] = 'os'
                local_name = alias.asname or alias.name.split('.')[0]
                aliases[local_name] = mod

        elif isinstance(node, ast.ImportFrom):
            if node.module:
                mod = node.module.split('.')[0]
                if mod in blocked_imports:
                    return False, f"Blocked import: {mod}"
                if strictness == 'strict' and mod not in ALLOWED_STRICT:
                    return False, f"Import '{mod}' not in allowlist"
                # Track `from os import system as sys_call`
                if node.names:
                    for alias in node.names:
                        local_name = alias.asname or alias.name
                        # If importing a blocked call (e.g. `from builtins import eval`)
                        if alias.name in BLOCKED_CALLS:
                            blocked_names.add(local_name)

        elif isinstance(node, ast.Assign):
            # Track simple aliasing: `x = os` or `x = eval`
            if (len(node.targets) == 1
                    and isinstance(node.targets[0], ast.Name)
                    and isinstance(node.value, ast.Name)):
                source = node.value.id
                target = node.targets[0].id
                # Resolve through existing aliases
                resolved = aliases.get(source, source)
                aliases[target] = resolved
                if source in blocked_names:
                    blocked_names.add(target)

        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in blocked_names:
                original = aliases.get(node.func.id, node.func.id)
                return False, f"Blocked call: {original}()"

        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            # Resolve the name through aliases
            resolved = aliases.get(node.value.id, node.value.id)
            if (resolved, node.attr) in blocked_attrs:
                return False, f"Blocked: {resolved}.{node.attr}"

    return True, ""


def validate_plugin_files(plugin_dir, strictness='strict'):
    """Validate all .py files in a plugin directory.

    Returns:
        (ok: bool, error_msg: str) — error_msg includes the failing file
    """
    from pathlib import Path
    plugin_path = Path(plugin_dir)

    for py_file in plugin_path.rglob('*.py'):
        try:
            source = py_file.read_text(encoding='utf-8')
        except Exception as e:
            return False, f"{py_file.name}: cannot read ({e})"

        ok, err = validate_code(source, strictness)
        if not ok:
            return False, f"{py_file.name}: {err}"

    return True, ""
