import requests

# Sessione globale, riutilizzata per tutte le chiamate
_session = requests.Session()

DEFAULT_TIMEOUT = 5  # secondi

def http_get(url, **kwargs):
    """Wrapper per GET con sessione riutilizzabile e timeout di default."""
    timeout = kwargs.pop("timeout", DEFAULT_TIMEOUT)
    return _session.get(url, timeout=timeout, **kwargs)

def http_post(url, **kwargs):
    """Wrapper per POST con sessione riutilizzabile e timeout di default."""
    timeout = kwargs.pop("timeout", DEFAULT_TIMEOUT)
    return _session.post(url, timeout=timeout, **kwargs)

def http_put(url, **kwargs):
    """Wrapper per PUT con sessione riutilizzabile e timeout di default."""
    timeout = kwargs.pop("timeout", DEFAULT_TIMEOUT)
    return _session.put(url, timeout=timeout, **kwargs)

def http_delete(url, **kwargs):
    """Wrapper per DELETE con sessione riutilizzabile e timeout di default."""
    timeout = kwargs.pop("timeout", DEFAULT_TIMEOUT)
    return _session.delete(url, timeout=timeout, **kwargs)

def add_cors_headers(response, methods="DELETE"):
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": methods,
        "Access-Control-Allow-Headers": "Content-Type"
    }
    for k, v in headers.items():
        response.headers.add(k, v)
    return response