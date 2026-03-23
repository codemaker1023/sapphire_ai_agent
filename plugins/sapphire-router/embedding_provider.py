"""Sapphire Router embedding provider — forwards to managed infrastructure."""
import logging
import numpy as np

logger = logging.getLogger(__name__)


class SapphireRouterEmbedder:
    """Forwards embedding requests to a Sapphire Router."""

    def _get_url(self):
        import os
        try:
            from core.plugin_loader import plugin_loader
            ps = plugin_loader.get_plugin_settings('sapphire-router')
            if ps and ps.get('router_url', '').strip():
                return ps['router_url'].strip().rstrip('/')
        except Exception:
            pass
        import config
        url = os.environ.get('SAPPHIRE_ROUTER_URL') or getattr(config, 'SAPPHIRE_ROUTER_URL', '')
        return url.rstrip('/')

    def _get_tenant_id(self):
        import os
        try:
            from core.plugin_loader import plugin_loader
            ps = plugin_loader.get_plugin_settings('sapphire-router')
            if ps and ps.get('tenant_id', '').strip():
                return ps['tenant_id'].strip()
        except Exception:
            pass
        import config
        return os.environ.get('SAPPHIRE_TENANT_ID') or getattr(config, 'SAPPHIRE_ROUTER_TENANT_ID', '')

    def embed(self, texts, prefix='search_document'):
        url = self._get_url()
        if not url:
            return None
        try:
            import httpx
            headers = {'Content-Type': 'application/json'}
            tenant_id = self._get_tenant_id()
            if tenant_id:
                headers['X-Tenant-ID'] = tenant_id
            resp = httpx.post(
                f'{url}/v1/embeddings/embed',
                json={'texts': texts, 'prefix': prefix},
                headers=headers,
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            if 'embeddings' in data:
                return np.array(data['embeddings'], dtype=np.float32)
            return None
        except Exception as e:
            import httpx as _hx
            if isinstance(e, _hx.ConnectError):
                logger.error(f"Sapphire Router embeddings: cannot reach router at {url}")
            else:
                logger.error(f"Sapphire Router embedding failed: {e}")
            return None

    @property
    def available(self):
        return bool(self._get_url())
