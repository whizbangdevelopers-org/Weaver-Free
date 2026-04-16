<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Your First NixOS + Weaver Install

A step-by-step walkthrough from "I have a NixOS ISO" to "Weaver is running in my browser." Every command you type and every screen you'll see.

> **Who this is for:** First-time NixOS users, or experienced Linux admins trying NixOS for the first time. No NixOS knowledge assumed.
>
> **Time:** ~30 minutes (depending on download speeds)
>
> **What you'll need:**
> - A machine or VM to install on (bare metal, virt-manager, VirtualBox, Hyper-V, etc.)
> - The NixOS Minimal ISO: [nixos.org/download](https://nixos.org/download/#nixos-iso) — select **Minimal ISO image**
> - Internet access on the target machine
> - A second device with a browser (your laptop, phone, etc.) to access the Weaver dashboard

---

## Step 1: Boot the NixOS ISO

Boot your machine from the NixOS ISO. You'll see the GRUB menu:

![NixOS boot menu](images/01-boot-menu.png)

Select **NixOS Installer** and press Enter. After a few seconds you'll land at a root shell:

```
<<< Welcome to NixOS ... >>>
```

<!-- TODO: screenshot of the initial installer shell -->

---

## Step 2: Run the NixOS installer

NixOS 25.11 includes a guided text installer. Start it:

```bash
sudo nixos-install-wizard
```

Or if using the graphical ISO, the installer launches automatically.

> **Using the minimal ISO (recommended)?** The minimal ISO drops you to a root shell. You can either:
> - Run the manual install steps from the [NixOS manual](https://nixos.org/manual/nixos/stable/#sec-installation)
> - Or use the TUI installer: `sudo nixos-install`

### Installer choices

The installer will ask you several questions. Here's what to pick:

| Question | What to select | Why |
|----------|---------------|-----|
| **Desktop environment** | **None / No desktop** | Weaver is a web app — access it from any browser on your network. No GUI needed on the host. |
| **Allow unfree software?** | **No** | Weaver is AGPL-3.0 and doesn't need unfree packages. |
| **Erase disk?** | **Yes** (for a fresh install) | Safe for VMs and dedicated hosts. |
| **Swap** | **No** (8 GB+ RAM) or **Yes, 2 GB** (4 GB RAM) | VMs run best in RAM. Small swap prevents OOM during builds. |
| **Hibernate** | **No** | Hibernation kills running VMs. |
| **Encrypt** | **No** (test VM) or **Yes** (production) | Skip for testing. Enable LUKS for production. |

<!-- TODO: screenshots of each installer step -->

### Set your user account

The installer will ask for:
- **Username** — pick whatever you like (e.g. `mark`, `admin`)
- **Password** — you'll use this to log in and for `sudo`

### Install and reboot

The installer downloads packages and builds your system. This takes a few minutes depending on your internet speed.

When done, remove the ISO and reboot.

---

## Step 3: First login

After reboot, you'll see the NixOS login prompt:

![NixOS first login](images/03-first-login.png)

```
<<< Welcome to NixOS 25.11... >>>

nixos login: your-username
Password:
```

Log in with the username and password you set during installation.

You're now at a shell prompt:
```
[your-username@nixos:~]$
```

### Verify internet access

```bash
ping -c 3 github.com
```

If this fails, check your network configuration. VMs using NAT typically work out of the box.

---

## Step 4: Get root access

Most of the remaining steps need root. Switch to a root shell:

```bash
sudo -s
```

Your prompt changes to:
```
[root@nixos:~]#
```

You'll stay in this root shell for the rest of the install.

---

## Step 5: Add git and nh to your system

The minimal install doesn't include `git` (needed to clone Weaver) or `nh` (nix-helper, for keeping your system clean).

Edit your configuration:

```bash
nano /etc/nixos/configuration.nix
```

Find the `environment.systemPackages` line and add `git` and `nh`:

```nix
  environment.systemPackages = with pkgs; [
    git
    nh
    nano    # or vim, if you prefer
  ];
```

Also enable flakes (recommended for Weaver updates):

```nix
  nix.settings.experimental-features = [ "nix-command" "flakes" ];
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

Apply the change:

```bash
nixos-rebuild switch
```

This downloads and installs git, nh, and enables flakes. Takes about a minute.

---

## Step 6: Clone Weaver

```bash
cd /home/your-username
git clone https://github.com/whizbangdevelopers-org/Weaver-Free.git
```

<!-- TODO: screenshot of successful clone -->

---

## Step 7: Add Weaver to your NixOS configuration

```bash
nano /etc/nixos/configuration.nix
```

Add the Weaver module import and enable the service:

```nix
{ config, pkgs, ... }:
{
  imports = [
    ./hardware-configuration.nix
    /home/your-username/Weaver-Free/nixos/default.nix    # ← add this line
  ];

  # ... your existing config ...

  # Weaver
  services.weaver = {
    enable = true;
    # openFirewall = true;   # enable if your firewall is active
  };
}
```

> **Replace `your-username`** with the actual username you created during install.

Save and rebuild:

```bash
nixos-rebuild switch
```

The first build compiles Weaver from source — this takes **2-5 minutes**. Subsequent rebuilds are near-instant thanks to the Nix store cache.

---

## Step 8: Open Weaver in your browser

Find the IP address of your NixOS machine:

```bash
ip addr show | grep 'inet '
```

Look for the IP on your main network interface (not `127.0.0.1`). For example: `192.168.122.45`.

On your laptop/phone/other device, open a browser and go to:

```
http://192.168.122.45:3100
```

> **Replace `192.168.122.45`** with your machine's actual IP.

![Weaver first-run setup](images/08-first-run-setup.png)

You'll see the **Create Admin Account** form. This only appears on the very first visit — no default credentials, no insecure defaults.

1. Choose a username (lowercase, 3+ characters)
2. Set a strong password (14+ characters, uppercase + lowercase + digit + special character)
3. Click **Create Account**

You're in. The Getting Started wizard will guide you from here.

<!-- TODO: screenshot of the dashboard after admin creation -->

---

## Step 9: Verify everything works

Back on your NixOS shell, check the service status:

```bash
systemctl status weaver
```

You should see `active (running)`. The dashboard in your browser should show the Getting Started wizard and a live WebSocket connection indicator in the header.

---

## What's next?

- **Explore the dashboard** — the Getting Started wizard walks you through the key features
- **Read the [Admin Guide](../../ADMIN-GUIDE.md)** — license configuration, network management, AI setup
- **Read the [User Guide](../../USER-GUIDE.md)** — daily usage, workload management, keyboard shortcuts
- **Keep your system clean** — run `nh clean all --keep 3` periodically to remove old NixOS generations

---

## Troubleshooting

### "nixos-rebuild: command not found"
You're not in a root shell. Run `sudo -s` first.

### The build fails with hash mismatch
The Weaver repo may have been updated since the packaged Nix hash was computed. Try:
```bash
cd /home/your-username/Weaver-Free
git pull
nixos-rebuild switch
```

### Can't reach the dashboard from my browser
1. Check the service is running: `systemctl status weaver`
2. Check the IP: `ip addr show`
3. Check the firewall: `sudo iptables -L -n` — if you see DROP rules, add `services.weaver.openFirewall = true;` to your config and rebuild

### WebSocket shows "Offline"
The backend may still be starting. Wait 10 seconds and refresh. If it persists, check `journalctl -u weaver -n 50` for errors.
