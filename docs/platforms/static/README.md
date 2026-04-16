<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Serving the Private Demo

The private demo is a static single-page application (SPA) with mock data. No backend, no database, no Node.js runtime required. Build it once, serve it from any web server.

## Build

```bash
cd code
VITE_DEMO_MODE=true npx quasar build -m spa
```

Output: `dist/spa/` — a directory of HTML, JS, and CSS files ready to serve.

## SPA Routing Requirement

Weaver uses client-side routing (`/weaver`, `/settings`, `/help`, etc.). Your web server must return `index.html` for all unknown paths, not a 404. Every option below includes this configuration.

## Serving Options

### Apache

Drop `dist/spa/` into a vhost or directory, then add a `.htaccess` file:

```
FallbackResource /index.html
```

Or configure the vhost directly:

```apache
<VirtualHost *:8080>
    DocumentRoot /path/to/dist/spa
    <Directory /path/to/dist/spa>
        AllowOverride All
        Require all granted
        FallbackResource /index.html
    </Directory>
</VirtualHost>
```

Restart Apache after changes:

```bash
sudo systemctl restart apache2   # Debian/Ubuntu
sudo systemctl restart httpd     # RHEL/NixOS
```

### Nginx

```nginx
server {
    listen 8080;
    root /path/to/dist/spa;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Node.js (npx serve)

Zero-config static server with SPA fallback:

```bash
npx serve dist/spa -s -l 3000
```

The `-s` flag enables single-page app mode (returns `index.html` for all routes).

### Python

```bash
cd dist/spa
python3 -m http.server 3000
```

> **Note:** Python's `http.server` does not support SPA fallback. Direct navigation to routes like `/weaver` will 404. Only use this for quick local previews where you navigate from the home page.

### Caddy

```
:8080 {
    root * /path/to/dist/spa
    file_server
    try_files {path} /index.html
}
```

## Offline / Air-Gapped Use

The demo is fully self-contained after building. No network requests are made at runtime — all data is mocked client-side. Copy the `dist/spa/` directory to a USB drive or internal network share and serve from any machine.

## Demo Features

The private demo includes:

- **Tier switcher** — toggle between Free, Weaver, and Fabrick feature sets in the toolbar
- **Version switcher** — preview features from different release versions
- **All pages** — dashboard, workload detail, network topology, settings, users, audit log, help
- **Mock data** — 8 sample VMs across multiple distros, hypervisors, and status types

## Updating

Rebuild when you want a newer version:

```bash
git pull
VITE_DEMO_MODE=true npx quasar build -m spa
```

Replace the served directory contents with the new `dist/spa/` output. No service restart needed — browsers will pick up the new files.
