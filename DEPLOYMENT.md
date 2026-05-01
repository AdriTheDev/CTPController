# Deployment Guide — Linux + nginx

Deploys CTP Controller at `https://ctp.<yourdomain>.com` using nginx as a
reverse proxy with Let's Encrypt HTTPS and nginx basic auth for access control.

---

## Prerequisites

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx apache2-utils
```

Install Node.js 24+:

```bash
sudo apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

---

## Step 1 — DNS

Add an A record at your registrar:

```
Type:  A
Name:  ctp
Value: <your server public IP>
TTL:   3600
```

Verify: `dig ctp.<yourdomain>.com +short`

---

## Step 2 — Build the app

```bash
cd /var/www
git clone https://github.com/AdriTheDev/CTPController
cd CTPController
npm install
npm run build        # outputs to dist/
```

---

## Step 3 — Create a basic auth password (Optional)

```bash
# Creates /etc/nginx/.htpasswd with a user called "ctp"
sudo htpasswd -c /etc/nginx/.htpasswd ctp
# Enter your chosen password when prompted
```

To add more users later (without -c flag, which would overwrite):

```bash
sudo htpasswd /etc/nginx/.htpasswd another_user
```

---

## Step 4 — nginx configuration

Create `/etc/nginx/sites-available/ctp`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ctp.<yourdomain>.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ctp.<yourdomain>.com;

    # SSL — filled in by Certbot
    ssl_certificate     /etc/letsencrypt/live/ctp.<yourdomain>.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ctp.<yourdomain>.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    auth_basic           "CTP Controller";
    auth_basic_user_file /etc/nginx/.htpasswd;

    add_header X-Frame-Options        "SAMEORIGIN"  always;
    add_header X-Content-Type-Options "nosniff"     always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    root  /var/www/CTPController/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~ ^/(manifest\.json|icons/) {
        auth_basic off;
        root  /var/www/CTPController/dist;
        try_files $uri =404;
        add_header Cache-Control "no-cache";
    }

    location ~ ^/(auth|api)/ {
        auth_basic off;

        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-Host  $host;
        proxy_read_timeout 30s;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/ctp /etc/nginx/sites-enabled/ctp
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 5 — Let's Encrypt certificate

```bash
sudo certbot --nginx -d ctp.<yourdomain>.com
```

Certbot edits the nginx config automatically with the cert paths.

Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

---

## Step 6 — Run Express as a systemd service

The Express server only handles `/auth/*` (Spotify PKCE) in production.

```bash
sudo nano /etc/systemd/system/CTPController.service
```

```ini
[Unit]
Description=CTP Stream Controller
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/CTPController
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

StandardOutput=journal
StandardError=journal
SyslogIdentifier=ctp-controller

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable ctp-controller
sudo systemctl start ctp-controller
sudo systemctl status ctp-controller
```

View logs:

```bash
sudo journalctl -u ctp-controller -f
```

---

## Step 7 — Spotify Redirect URI

In your Spotify Developer dashboard, add:

```
https://ctp.<yourdomain>.com/auth/spotify/callback
```

---

## Updating the app

```bash
cd /var/www/CTPController
git pull
npm install
npm run build
sudo systemctl restart ctp-controller
sudo systemctl reload nginx
```

---

## Changing the password

```bash
sudo htpasswd /etc/nginx/.htpasswd ctp
sudo systemctl reload nginx
```

---

## Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Troubleshooting

**502 Bad Gateway on /auth/\* routes**
The Express server isn't running.
Check: `sudo systemctl status ctp-controller`

**Spotify auth or config returns 401 / fails silently**
The `auth_basic off` directive is missing or not applying for `/auth/` or `/api/`.
The nginx location block must be `location ~ ^/(auth|api)/` — check the config
and run `sudo nginx -t && sudo systemctl reload nginx`.

**Basic auth prompt appears on the Spotify callback tab**
Same as above — ensure `auth_basic off` is set for `/auth/spotify/callback`.
