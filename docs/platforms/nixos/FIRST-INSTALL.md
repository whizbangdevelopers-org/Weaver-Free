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

## Step 5: Add git, nh, SSH, and flakes to your system

The fresh install doesn't include `git` (needed to clone Weaver) or `nh` (nix-helper, for keeping your Nix store clean). You also need SSH enabled so you can work from your workstation, and flakes enabled for Weaver updates.

All of this is done by editing one file:

```bash
nano /etc/nixos/configuration.nix
```

You'll see the default NixOS configuration. Make these **three changes**.

> **Shell & nano tips for new users:**
> - **Up arrow** at the shell prompt recalls previous commands — no need to retype `nixos-rebuild switch` every time
> - In nano, use **arrow keys** to navigate, **Page Up/Page Down** to scroll fast, **Home/End** to jump to start/end of a line
> - Use **spaces, not tabs** for indentation — NixOS config uses 2-space indent (4 spaces inside the brackets is fine too, just be consistent and never use Tab)
> - `Ctrl+S` to save (or `Ctrl+O` → `Enter`), `Ctrl+X` to exit
> - `Ctrl+W` to search for text (helpful for finding `systemPackages` quickly)

![NixOS default configuration.nix](images/05-config-before.png)

### Change 1: Add git and nh to system packages

Scroll down until you see this block (about halfway down):

```nix
  # List packages installed in system profile. To search, run:
  # $ nix search wget
  environment.systemPackages = with pkgs; [
  #  vim # Do not forget to add an editor to edit configuration.nix! The Nano editor is also installed by default.
  #  wget
  ];
```

Add `git` and `nh` inside the brackets (below the commented lines):

```nix
  environment.systemPackages = with pkgs; [
  #  vim
  #  wget
    git
    nh
  ];
```

### Change 2: Uncomment the SSH line

Scroll further down until you see:

```nix
  # Enable the OpenSSH daemon.
  # services.openssh.enable = true;
```

Remove the `#` at the start of the second line so it reads:

```nix
  # Enable the OpenSSH daemon.
  services.openssh.enable = true;
```

This lets you connect to the machine remotely from your workstation using SSH — optional, but much easier than typing in the VM console. If you don't know what SSH is, skip this — everything below works fine typed directly into the VM.

### Change 3: Enable flakes

Scroll to the very bottom of the file. You'll see:

```nix
  # This value determines the NixOS release from which the default
  # settings for stateful data, like file locations and database versions
  # ...
  system.stateVersion = "25.11"; # Did you read the comment?

}
```

**Add this line right ABOVE `system.stateVersion`:**

```nix
  nix.settings.experimental-features = [ "nix-command" "flakes" ];

  system.stateVersion = "25.11"; # Did you read the comment?
```

> **Do not change the `system.stateVersion` line.** It tells NixOS which version's defaults to use. Leave it as-is.

### Save and apply

Save the file: `Ctrl+S`, then `Ctrl+X` to exit.

Apply the changes:

```bash
nixos-rebuild switch
```

This downloads and installs git, nh, enables SSH, and turns on flakes. Takes about a minute. You'll see Nix downloading packages — that's normal.

![nixos-rebuild switch in progress](images/05-rebuild.png)

Once it finishes with no errors, git is available and you can clone Weaver.

---

## Step 6: Clone Weaver

Exit the root shell to return to your normal user (you're already in your home directory):

```bash
exit
```

Your prompt changes back to `[your-username@nixos:~]$`. Now clone Weaver:

```bash
git clone https://github.com/whizbangdevelopers-org/Weaver-Free.git
```

You should see git downloading the repository. When it finishes:

```bash
ls Weaver-Free/
```

You should see directories like `backend/`, `src/`, `nixos/`, `README.md`, etc.

> **Tip:** If you enabled SSH in the previous step and know how to use it, you can continue the remaining steps from your workstation: `ssh your-username@<vm-ip>`. This is optional — everything works fine typed directly into the VM.

<!-- TODO: screenshot of successful clone -->

---

## Step 7: Add Weaver to your NixOS configuration

Get back into a root shell and open the config again:

```bash
sudo -s
nano /etc/nixos/configuration.nix
```

You're making **two additions** to the same file you edited in Step 5.

### Addition 1: Import the Weaver module

Scroll to the **top** of the file. You'll see the `imports` block:

```nix
  imports = [
    ./hardware-configuration.nix
  ];
```

Add a second line inside the brackets so it looks like this:

```nix
  imports = [
    ./hardware-configuration.nix
    /home/your-username/Weaver-Free/nixos/default.nix
  ];
```

> **Replace `your-username`** with the username you created during install (e.g. `/home/mark/Weaver-Free/nixos/default.nix`).

### Addition 2: Enable the Weaver service

Scroll down to the `nix.settings.experimental-features` line you added in Step 5. **Right below it**, add the Weaver service:

```nix
  nix.settings.experimental-features = [ "nix-command" "flakes" ];

  # Weaver
  services.weaver = {
    enable = true;
    openFirewall = true;
  };

  system.stateVersion = "25.11"; # Did you read the comment?
```

Adding it below something you just typed gives you a familiar landmark — you know you're in the right spot.

> **"Why couldn't I do this in Step 5?"** Because git wasn't installed yet — you needed the first rebuild to get git, clone the repo, and only THEN can you point `imports` at the repo on disk. That's why we do two edits.
>
> **What does `openFirewall` do?** NixOS enables a firewall by default that blocks incoming connections. Without `openFirewall = true`, you can reach Weaver at `http://localhost:3100` from the NixOS machine itself, but your browser on another device can't connect. This setting opens port 3100.

### Save and rebuild

Save (`Ctrl+S`, `Ctrl+X`), then:

```bash
nixos-rebuild switch
```

The first build compiles Weaver from source — this takes **2-5 minutes**. You'll see lots of Nix output scrolling by. Subsequent rebuilds are near-instant thanks to the Nix store cache.

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
