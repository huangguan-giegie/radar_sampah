"""Keep health checks responsive while database or model requests are running."""

workers = 1
worker_class = "gthread"
threads = 4
