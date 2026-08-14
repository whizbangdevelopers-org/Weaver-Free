# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
{ config, pkgs, lib, ... }:

with lib;

let
  cfg = config.services.weaver;

  # Import the shared package definition (single source of truth for hashes)
  weaver = import ./package.nix { inherit pkgs; };
in
{
  # `premiumEnabled` → `soloTierEnabled` (v1.1). A rename rather than a removal: an existing
  # configuration.nix must keep evaluating across the upgrade, and mkRenamedOptionModule both
  # forwards the value and emits a warning naming the new option, so a user learns about it at
  # rebuild time instead of discovering an eval error.
  #
  # "Premium" has not been a tier name for some time — the tiers are Free / Solo / Team /
  # Fabrick. This option was the last place the retired name was still user-facing; everything
  # else is either
  # the internal PREMIUM_ENABLED env bridge the backend documents as backward compat, or docs
  # describing that bridge.
  imports = [
    (lib.mkRenamedOptionModule
      [ "services" "weaver" "premiumEnabled" ]
      [ "services" "weaver" "soloTierEnabled" ])
  ];

  options.services.weaver = {
    enable = mkEnableOption "Weaver web interface";

    port = mkOption {
      type = types.port;
      default = 3100;
      description = "Port for the dashboard API server";
    };

    host = mkOption {
      type = types.str;
      default = "0.0.0.0";
      description = "Host to bind the API server to. Default 0.0.0.0 (all interfaces) so the dashboard is reachable from other devices. Set to 127.0.0.1 for localhost-only.";
    };

    openFirewall = mkOption {
      type = types.bool;
      default = false;
      description = "Whether to open the firewall for the dashboard port";
    };

    package = mkOption {
      type = types.package;
      default = weaver;
      description = "The weaver package to use";
    };

    licenseKey = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        License key string (WVR-<tier>-<payload>-<checksum>).
        Determines feature tier: free, weaver (Solo/Team), or fabrick.
        No key = demo mode.
      '';
    };

    licenseKeyFile = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        Path to a file containing the license key.
        Useful for secret management with sops-nix.
        Takes precedence over licenseKey if both are set.
      '';
    };

    licenseHmacSecret = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        HMAC secret for license key validation, as a literal string.
        WARNING: this lands in the world-readable Nix store. Prefer
        licenseHmacSecretFile (sops-nix) for any real deployment.
      '';
    };

    licenseHmacSecretFile = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        Path to a file containing the HMAC secret for license validation.
        Use this with secret management (sops-nix) so the secret never enters
        the Nix store. Read at runtime via LICENSE_HMAC_SECRET_FILE; takes
        precedence over licenseHmacSecret.
      '';
    };

    # Renamed from `premiumEnabled` (v1.1). The old name still works — see the
    # `mkRenamedOptionModule` in `imports` — so an existing configuration.nix keeps
    # evaluating, with a rename warning on the next `nixos-rebuild switch`.
    #
    # The name is `soloTierEnabled`, NOT the `weaverTierEnabled` this comment used to
    # promise: "weaver tier" stopped being a single tier once Solo and Team became distinct
    # issued tiers, so that name would have retired one piece of stale vocabulary by
    # introducing another. What the flag actually does is grant Solo —
    # `soloTierEnabled` says exactly that and nothing more.
    #
    # It remains DEPRECATED in favour of licenseKey. Renaming it does not bless it;
    # it removes the last user-facing use of a retired tier name.
    soloTierEnabled = mkOption {
      type = types.bool;
      default = false;
      description = ''
        DEPRECATED: Use licenseKey instead.

        When true and no licenseKey is set, the backend runs at Solo tier. This is a
        legacy bridge for deployments that predate license keys; it grants tier access
        without a key, so it must not be used on anything you intend to license.

        Renamed from `premiumEnabled` in v1.1. The old name is still accepted and will
        warn on rebuild.
      '';
    };

    storageBackend = mkOption {
      type = types.enum [ "json" "sqlite" ];
      default = "json";
      description = "Storage backend for VM registry";
    };

    dataDir = mkOption {
      type = types.str;
      default = "/var/lib/weaver";
      description = "Directory for persistent data storage";
    };

    provisioningEnabled = mkOption {
      type = types.bool;
      default = true;
      description = "Enable VM provisioning (creates and manages cloud VMs via QEMU). Includes bridge networking, NAT, and IP forwarding.";
    };

    microvmsDir = mkOption {
      type = types.str;
      default = "/var/lib/microvms";
      description = "Directory for MicroVM disk images and cloud-init ISOs";
    };

    bridgeInterface = mkOption {
      type = types.str;
      default = "br-microvm";
      description = "Bridge interface name for VM networking";
    };

    bridgeGateway = mkOption {
      type = types.str;
      default = "10.10.0.1";
      description = "Gateway IP address on the VM bridge (host-side)";
    };

    uefi = {
      enable = mkEnableOption "OVMF UEFI firmware for guests (required by Windows 11)";

      secureBootCapable = mkOption {
        type = types.bool;
        default = false;
        description = ''
          Use the Secure Boot capable OVMF build (`OVMF_CODE.ms.fd` / `OVMF_VARS.ms.fd`, with
          Microsoft's keys pre-enrolled) instead of the plain one.

          Off by default because it is not free: the plain build boots anything, while the
          pre-enrolled build refuses unsigned bootloaders — which is the point for a Windows 11
          guest and an obstacle for a home-built Linux image. Weaver always passes `smm=on`, so
          the variable store is protected either way; this option only chooses which keys the
          guest starts with.
        '';
      };

      tpm = mkOption {
        type = types.bool;
        default = cfg.uefi.enable;
        defaultText = literalExpression "config.services.weaver.uefi.enable";
        description = ''
          Provide each UEFI guest with an emulated TPM 2.0 via swtpm.

          Defaults to ON with UEFI, because Windows 11 Setup checks for TPM 2.0 **and** UEFI and
          refuses with "This PC can't run Windows 11" when either is missing. Shipping UEFI alone
          would advertise Windows 11 support that does not actually install.

          Turn it off for a Linux UEFI guest that has no use for measured boot; the emulator is a
          per-VM process and a per-VM state directory.
        '';
      };

      virtioWinIso = mkOption {
        type = types.nullOr types.path;
        default = null;
        example = "/var/lib/weaver/images/virtio-win.iso";
        description = ''
          Path to the virtio-win driver ISO, attached as a second CDROM for Windows guests that
          request it. Roughly a 3–5x I/O improvement over the driver-free IDE + e1000 defaults.

          NOT downloaded automatically, and deliberately so — it is Red Hat redistributable
          material with its own terms, and silently fetching it on the operator's behalf makes a
          licensing decision that is theirs. Fetch it into the Nix store yourself
          (`pkgs.fetchurl`) or drop it on the host and name the path.
        '';
      };
    };

    nixLd = {
      enable = mkOption {
        type = types.bool;
        default = true;
        description = ''
          Enable `nix-ld`, which lets unpatched dynamically-linked binaries run on NixOS.

          On by default because it removes the most common objection to running NixOS at all: a
          binary downloaded from the internet — a vendor SDK, a CUDA toolkit, a language server,
          an editor's remote agent — has `/lib64/ld-linux-x86-64.so.2` baked into its ELF header,
          and a stock NixOS host cannot run it.

          **What it does NOT fix, because NixOS already did.** Since `environment.stub-ld`, a
          stock host does have something at that path: a stub whose only job is to fail with an
          explanation and a documentation link, rather than the bare "no such file or directory"
          that made this a famously confusing first hour. Verified on NixOS 26.05 — the path is a
          symlink to `stub-ld`, and the message names the problem outright. So nix-ld is not worth
          enabling for the error message; the error message is already good. It is worth enabling
          because the binary then **runs**.

          **What it changes on the host:** replaces that stub with a real loader shim and sets
          `NIX_LD` for all users. It runs nothing and opens nothing, and a binary that never looked
          for the FHS loader is unaffected. Set to `false` to keep the stub — which is the right
          choice if you would rather a stray prebuilt binary fail loudly than silently work.
        '';
      };

      libraries = mkOption {
        type = types.listOf types.package;
        default = [ ];
        description = ''
          **Additional** libraries made visible to those binaries, on top of the set nixpkgs
          already supplies through `programs.nix-ld.libraries`.

          Empty by default, and that is not an oversight. `programs.nix-ld.libraries` is a MERGED
          list, and nixpkgs' own default already covers the common ground — gcc's `libstdc++`,
          zlib, openssl, curl, zstd, xz, bzip2, libxml2, libssh, libsodium, attr, acl, util-linux
          and systemd. Restating any of those here does not strengthen anything; it just lands the
          same store path in the list twice. (Measured: an earlier draft of this option defaulted
          to `[ stdenv.cc.cc.lib zlib openssl ]` and produced exactly that — 17 entries, three of
          them duplicates, and no behavioural difference whatsoever.)

          So reach for this only for something genuinely outside that base — `icu`, `libGL`,
          `alsa-lib`, a vendor runtime. The loader shim resolves the *interpreter*; the binary
          then asks for its real shared libraries by name, and `ldd` on it says which is missing.
          Add the package that provides it rather than turning the whole feature off.
        '';
        example = literalExpression "with pkgs; [ icu libGL alsa-lib ]";
      };
    };

    serviceUser = mkOption {
      type = types.str;
      default = "weaver";
      description = ''
        User account under which the dashboard service runs.
        Defaults to a dedicated system user. Set to your own username
        (e.g. "mark") for development so that data directories are
        owned by your account and EACCES errors after rebuild are avoided.
      '';
    };

    serviceGroup = mkOption {
      type = types.str;
      default = "weaver";
      description = ''
        Group under which the dashboard service runs.
        Defaults to a dedicated system group. Set to "users" or your
        own group for development.
      '';
    };

    distroCatalogUrl = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Optional remote URL to refresh the curated distro catalog";
    };

    jwtSecret = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        JWT signing secret for authentication tokens.
        REQUIRED in production. If not set, a random secret is generated
        (tokens will not survive service restarts).
      '';
    };

    jwtSecretFile = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        Path to a file containing the JWT secret.
        Useful for secret management with sops-nix.
        Takes precedence over jwtSecret if both are set.
      '';
    };

    initialAdminPassword = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        Initial admin password for first-run setup.
        If set and no users exist, an admin account is created automatically
        with username "admin" and this password. Ignored after first user exists.
        For production, use initialAdminPasswordFile instead.
      '';
    };

    initialAdminPasswordFile = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        Path to a file containing the initial admin password.
        Same behavior as initialAdminPassword but reads from a file.
      '';
    };

    aiApiKey = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        API key for server-side AI agent features (any supported vendor).
        When set, weaver+ tier users can use the server key instead of BYOK.
        For production, use aiApiKeyFile instead.
      '';
    };

    aiApiKeyFile = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        Path to a file containing the AI API key.
        Useful for secret management with sops-nix.
        Takes precedence over aiApiKey if both are set.
      '';
    };

    aiVendor = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        AI vendor for server-side agent features (e.g. "anthropic").
        Defaults to "anthropic" when not set.
      '';
    };

    lscpuBin = mkOption {
      type = types.str;
      default = "/run/current-system/sw/bin/lscpu";
      description = "Path to lscpu binary for CPU topology detection";
    };

    dfBin = mkOption {
      type = types.str;
      default = "/run/current-system/sw/bin/df";
      description = "Path to df binary for disk usage detection";
    };

    nixosVersionBin = mkOption {
      type = types.str;
      default = "/run/current-system/sw/bin/nixos-version";
      description = "Path to nixos-version binary for NixOS version detection";
    };

    weasyprintBin = mkOption {
      type = types.str;
      default = "${pkgs.python3Packages.weasyprint}/bin/weasyprint";
      description = "Path to weasyprint binary for compliance PDF generation";
    };

    # ── Container runtimes (container visibility, gap 3) ───────────────────────────────────
    #
    # Every other external binary this module depends on is pinned explicitly (lscpuBin, dfBin,
    # nixosVersionBin, weasyprintBin). The container runtimes were the inconsistent case: config.ts
    # reads DOCKER_BIN / PODMAN_BIN / APPTAINER_BIN, the module never exported them, so they fell
    # back to BARE NAMES resolved against whatever the unit's PATH happened to contain. A systemd
    # unit gets a minimal PATH, so "it works in my shell" says nothing about the service.
    containerRuntimes = mkOption {
      type = types.listOf (types.enum [ "docker" "podman" "apptainer" ]);
      default = [ ];
      example = [ "docker" "podman" ];
      description = ''
        Which container runtimes Weaver should scan and manage.

        Empty (the default) means Weaver manages MicroVMs only — no container scan is attempted,
        so a host without a runtime installed does not pay for probing binaries that are not there.

        Declaring a runtime here does NOT install it; it tells Weaver to use it, and adds the
        matching package to the service PATH. Install the runtime the normal NixOS way
        (`virtualisation.docker.enable`, `virtualisation.podman.enable`, or `apptainer` in
        `environment.systemPackages`).
      '';
    };

    metrics = {
      enable = mkOption {
        type = types.bool;
        default = true;
        description = ''
          Run Prometheus alongside Weaver and scrape its `/metrics` endpoint.

          On by DEFAULT, and on every tier including Free. The feature exists to close a
          credibility gap — "open Proxmox, see graphs; open Weaver, see nothing" — and a graphing
          stack a user has to discover and enable does not close it. The alternative considered and
          rejected was Free keeping an in-process ring buffer while paid tiers got Prometheus,
          which would have committed the product to two metrics backends permanently.

          Retention is the tier lever, not this switch: the API clamps what a tier may SEE
          (`resolveWindowMs`), while the store below keeps whatever the host is configured to keep.

          Turn it off on a genuinely constrained host. Nothing else breaks — the in-process
          collector still serves the existing metrics API.
        '';
      };

      retention = mkOption {
        type = types.str;
        default = "7d";
        example = "24h";
        description = ''
          How long Prometheus keeps samples (`--storage.tsdb.retention.time`).

          This is HOST STORAGE, not the tier lever. The API never serves a window longer than 24
          hours, so anything beyond that is there for an operator's own deep dive rather than for
          the product UI — which is why the default is a week rather than a fortnight, and why
          lowering it to `24h` on a small host costs nothing the product would have shown.

          Do not set it BELOW the longest window a tier may request, or a paid user asking for 24
          hours gets a chart that runs out of data partway with no indication why.
        '';
      };

      port = mkOption {
        type = types.port;
        default = 9090;
        description = ''
          Port for the Prometheus server itself.

          Bound to loopback (see `listenAddress`), so this is the port a local Grafana or a `curl`
          uses, not one to open in the firewall.
        '';
      };

      listenAddress = mkOption {
        type = types.str;
        default = "127.0.0.1";
        description = ''
          Address Prometheus binds. Loopback by default, deliberately.

          The store holds every workload's series with no notion of Weaver's per-VM ACLs, so
          exposing it is equivalent to publishing the full workload inventory and its usage to
          anyone who can reach the port. That is the same reason Weaver's own `/metrics` endpoint
          refuses non-loopback callers, and the same reason the product UI reads metrics through
          Weaver's API rather than querying Prometheus directly.

          Widen it only together with authentication in front — never on its own.
        '';
      };
    };

    dns = {
      enable = mkEnableOption ''
        DNS Core — the .vm.internal auto-zone.

        Weaver generates a hosts file from the workload registry and runs a dnsmasq stub that
        answers the internal zone and forwards everything else upstream. Requires Weaver Solo or
        higher; on Free the zone is not generated and this option does nothing.
      '';

      domain = mkOption {
        type = types.str;
        default = "vm.internal";
        example = "lab.example";
        description = ''
          Domain for the auto-generated zone. Every workload with an address gets
          `<name>.<domain>` and a matching reverse record.

          NEVER set this to anything under `.local`. That TLD is reserved for mDNS (RFC 6762), so
          a `.local` zone collides with Avahi/Bonjour — which is running on most home networks —
          and the result is intermittent, host-dependent resolution failure rather than a clean
          error. `.internal` is the reserved private-use TLD and is the default for that reason.
        '';
      };

      listenInterfaces = mkOption {
        type = types.listOf types.str;
        default = [ ];
        example = [ "br-microvm" ];
        description = ''
          Interfaces the stub resolver binds to. Empty means the configured bridge only.

          Deliberately NOT `0.0.0.0`: an open resolver on a LAN interface is both an amplification
          reflector and a way for anything on the network to enumerate your workloads by name.
          Bind to the bridge the VMs are actually on.
        '';
      };

      upstream = mkOption {
        type = types.listOf types.str;
        default = [ "1.1.1.1" "9.9.9.9" ];
        description = "Upstream resolvers for names outside the internal zone.";
      };

      dnsmasqBin = mkOption {
        type = types.str;
        default = "${pkgs.dnsmasq}/bin/dnsmasq";
        description = "Path to the dnsmasq binary that serves the generated zone.";
      };
    };

    dockerBin = mkOption {
      type = types.str;
      default = "${pkgs.docker}/bin/docker";
      description = "Path to the docker binary used for container scan and lifecycle";
    };

    podmanBin = mkOption {
      type = types.str;
      default = "${pkgs.podman}/bin/podman";
      description = "Path to the podman binary used for container scan and lifecycle";
    };

    apptainerBin = mkOption {
      type = types.str;
      default = "${pkgs.apptainer}/bin/apptainer";
      description = ''
        Path to the apptainer binary. Apptainer is Solo-gated at every operation (Decision
        WVR-206) and is not docker-compatible — it has no `logs` subcommand and enumerates
        instances via `instance list --json`.
      '';
    };

  };

  config = let
    # Only create a dedicated system user/group when using the defaults.
    # When serviceUser is overridden (e.g. to "mark" for dev), the user
    # is expected to already exist on the system.
    isDefaultUser = cfg.serviceUser == "weaver";
    isDefaultGroup = cfg.serviceGroup == "weaver";
    user = cfg.serviceUser;
    group = cfg.serviceGroup;

    # Packages for the runtimes the operator DECLARED — never all three. Putting an undeclared
    # runtime on the PATH would add its whole closure to every Weaver host (docker and podman are
    # each hundreds of MiB) to serve a scan that will never run.
    runtimePackage = { inherit (pkgs) docker podman apptainer; };
    containerRuntimePackages = map (r: runtimePackage.${r}) cfg.containerRuntimes;
  in mkIf cfg.enable (mkMerge [
    # --- Base configuration (always applied) ---
    {
      # System user (only created when using the default dedicated user)
      users.users.${user} = mkIf isDefaultUser {
        isSystemUser = true;
        inherit group;
        home = cfg.dataDir;
        createHome = true;
        # "users" group membership lets the service traverse a 750 home directory.
        # Combined with the 0711 tmpfiles rule below.
        extraGroups = [ "users" ];
      };
      users.groups.${group} = mkIf isDefaultGroup {};

      # Management scripts (available system-wide)
      environment.systemPackages = [
        (pkgs.writeShellScriptBin "weaver-uninstall" ''
          export WEAVER_DATA_DIR="${cfg.dataDir}"
          exec ${pkgs.bash}/bin/bash ${cfg.package}/lib/weaver/scripts/nix-uninstall.sh "$@"
        '')
        (pkgs.writeShellScriptBin "weaver-fresh-install" ''
          export WEAVER_DATA_DIR="${cfg.dataDir}"
          export WEAVER_MICROVMS_DIR="${cfg.microvmsDir}"
          exec ${pkgs.bash}/bin/bash ${cfg.package}/lib/weaver/scripts/nix-fresh-install.sh "$@"
        '')
        (pkgs.writeShellScriptBin "weaver-reset-password" ''
          export WEAVER_DATA_DIR="${cfg.dataDir}"
          # Workspace deps are hoisted to the package's root node_modules
          export WEAVER_NODE_MODULES="${cfg.package}/lib/weaver/node_modules"
          # reset-admin-password.sh calls bare `node` three times, and a NixOS host running Weaver
          # has no node on PATH — not in a non-interactive shell and not in a login shell. Nothing
          # puts one there: the package's own nodejs sits in the closure but was never exposed.
          #
          # So this tool — the EMERGENCY recovery path, the one reached for while locked out —
          # exited 127 on a clean install, after printing "Resetting password for 'admin'..." so it
          # looked like it had started work. Verified against a real deployment 2026-08-13.
          #
          # Same rule the backend and TUI launchers in package.nix already follow
          # (`${"\${pkgs.nodejs_24}"}/bin/node`): reference binaries by full store path, never rely
          # on ambient PATH.
          export PATH="${pkgs.nodejs_24}/bin:$PATH"
          exec ${pkgs.bash}/bin/bash ${cfg.package}/lib/weaver/scripts/reset-admin-password.sh "$@"
        '')
      ];
      # nix-install.sh is NOT exposed system-wide — it's the bootstrap.
      # Users run it once from a source checkout to add Weaver to their NixOS
      # config. After that, weaver-uninstall / weaver-fresh-install /
      # weaver-reset-password handle the lifecycle.

      # Data directory
      systemd.tmpfiles.rules = [
        "d ${cfg.dataDir} 0750 ${user} ${group} -"
      ];

      # Sudo rules for managing microvm@ systemd units
      security.sudo.extraRules = [{
        users = [ user ];
        commands = [
          { command = "/run/current-system/sw/bin/systemctl start microvm@*"; options = [ "NOPASSWD" ]; }
          { command = "/run/current-system/sw/bin/systemctl stop microvm@*"; options = [ "NOPASSWD" ]; }
          { command = "/run/current-system/sw/bin/systemctl restart microvm@*"; options = [ "NOPASSWD" ]; }
          { command = "/run/current-system/sw/bin/systemctl is-active microvm@*"; options = [ "NOPASSWD" ]; }
          { command = "/run/current-system/sw/bin/systemctl show microvm@*"; options = [ "NOPASSWD" ]; }
          { command = "/run/current-system/sw/bin/systemctl status microvm@*"; options = [ "NOPASSWD" ]; }
        ];
      }];

      # Systemd service
      systemd.services.weaver = {
        description = "Weaver";
        after = [ "network.target" ];
        wantedBy = [ "multi-user.target" ];

        # WeasyPrint available to all tiers for compliance PDF export.
        #
        # Declared container runtimes go on the unit PATH as well as being exported as absolute
        # *_BIN paths. Both are load-bearing and they are not redundant: the *_BIN vars are what
        # config.ts reads, while the PATH entry covers anything the runtime itself shells out to
        # (docker/podman invoke helpers; apptainer resolves `go`, `squashfuse`, `fuse2fs` and
        # friends through findOnPath at runtime). A systemd unit gets a MINIMAL PATH, so a binary
        # that resolves in an interactive shell is still invisible to the service — which is the
        # bug this option exists to end.
        path = [ pkgs.python3Packages.weasyprint ] ++ containerRuntimePackages;

        environment = {
          NODE_ENV = "production";
          PORT = toString cfg.port;
          HOST = cfg.host;
          LOG_LEVEL = "info";
          HOME = cfg.dataDir;
          STATIC_DIR = "${cfg.package}/lib/weaver/frontend";
          DOCS_ROOT = "${cfg.package}/lib/weaver/docs";
          WEASYPRINT_BIN = cfg.weasyprintBin;
          # The ENV name stays PREMIUM_ENABLED: it is the backend's documented backward-compat
          # bridge (config.ts resolution order 3, which logs its own deprecation), and renaming it
          # would break every non-Nix deployment that sets it directly. The user-facing option is
          # what got the retired vocabulary out of the interface.
          PREMIUM_ENABLED = if cfg.soloTierEnabled then "true" else "false";
          VM_STORAGE_BACKEND = cfg.storageBackend;
          VM_DATA_DIR = cfg.dataDir;
          SUDO_PATH = "/run/wrappers/bin/sudo";
          SYSTEMCTL_PATH = "/run/current-system/sw/bin/systemctl";
          IPTABLES_PATH = "/run/current-system/sw/bin/iptables";
        } // optionalAttrs (cfg.licenseKey != null) {
          LICENSE_KEY = cfg.licenseKey;
        } // optionalAttrs (cfg.licenseKeyFile != null) {
          LICENSE_KEY_FILE = cfg.licenseKeyFile;
        } // optionalAttrs (cfg.licenseHmacSecret != null) {
          LICENSE_HMAC_SECRET = cfg.licenseHmacSecret;
        } // optionalAttrs (cfg.licenseHmacSecretFile != null) {
          LICENSE_HMAC_SECRET_FILE = cfg.licenseHmacSecretFile;
        } // optionalAttrs (cfg.distroCatalogUrl != null) {
          DISTRO_CATALOG_URL = cfg.distroCatalogUrl;
        } // optionalAttrs (cfg.jwtSecret != null) {
          JWT_SECRET = cfg.jwtSecret;
        } // optionalAttrs (cfg.jwtSecretFile != null) {
          JWT_SECRET_FILE = cfg.jwtSecretFile;
        } // optionalAttrs (cfg.jwtSecret == null && cfg.jwtSecretFile == null) {
          # Auto-generated secret — ExecStartPre creates the file if missing
          JWT_SECRET_FILE = "${cfg.dataDir}/.jwt-secret";
        } // optionalAttrs (cfg.initialAdminPassword != null) {
          INITIAL_ADMIN_PASSWORD = cfg.initialAdminPassword;
        } // optionalAttrs (cfg.initialAdminPasswordFile != null) {
          INITIAL_ADMIN_PASSWORD_FILE = cfg.initialAdminPasswordFile;
        } // optionalAttrs (cfg.aiApiKey != null) {
          AI_API_KEY = cfg.aiApiKey;
        } // optionalAttrs (cfg.aiApiKeyFile != null) {
          AI_API_KEY_FILE = cfg.aiApiKeyFile;
        } // optionalAttrs (cfg.aiVendor != null) {
          AGENT_VENDOR = cfg.aiVendor;
        } // {
          LSCPU_BIN = cfg.lscpuBin;
          DF_BIN = cfg.dfBin;
          NIXOS_VERSION_BIN = cfg.nixosVersionBin;
        } // {
          # Declared runtimes only. Exporting a bin for a runtime the operator did not declare
          # would make config.ts believe it is available and scan for containers that cannot
          # exist — the scan returns empty either way, but it spends an exec per poll doing it.
          CONTAINER_RUNTIMES = concatStringsSep "," cfg.containerRuntimes;
        } // optionalAttrs (elem "docker" cfg.containerRuntimes) {
          DOCKER_BIN = cfg.dockerBin;
        } // optionalAttrs (elem "podman" cfg.containerRuntimes) {
          PODMAN_BIN = cfg.podmanBin;
        } // optionalAttrs (elem "apptainer" cfg.containerRuntimes) {
          APPTAINER_BIN = cfg.apptainerBin;
        };

        serviceConfig = {
          Type = "simple";
          User = user;
          Group = group;
          ExecStart = "${cfg.package}/bin/weaver";
          Restart = "on-failure";
          RestartSec = "10s";
          WorkingDirectory = cfg.dataDir;
        } // optionalAttrs (cfg.jwtSecret == null && cfg.jwtSecretFile == null) {
          # Auto-generate JWT secret on first start if none is configured.
          # Persists to dataDir so it survives restarts. Users should configure
          # jwtSecretFile for production (sops-nix recommended).
          ExecStartPre = pkgs.writeShellScript "weaver-init-jwt" ''
            JWT_FILE="${cfg.dataDir}/.jwt-secret"
            if [ ! -f "$JWT_FILE" ]; then
              ${pkgs.openssl}/bin/openssl rand -base64 32 > "$JWT_FILE"
              chmod 600 "$JWT_FILE"
              echo "[weaver] Generated JWT secret at $JWT_FILE"
            fi
          '';
        };
      };

      # Firewall
      networking.firewall.allowedTCPPorts = mkIf cfg.openFirewall [ cfg.port ];
    }

    # --- nix-ld: let unpatched binaries run on the host ---
    # Deliberately NOT gated on provisioningEnabled. This is about the host being usable to a
    # person with a downloaded binary, which is true whether or not Weaver provisions anything.
    (mkIf cfg.nixLd.enable {
      programs.nix-ld = {
        enable = true;
        libraries = cfg.nixLd.libraries;
      };
    })

    # --- Provisioning configuration (conditional) ---
    (mkIf cfg.provisioningEnabled {
      # Add kvm group for QEMU hardware acceleration
      users.users.${user}.extraGroups = [ "kvm" ];

      # MicroVMs storage directory
      systemd.tmpfiles.rules = [
        "d ${cfg.microvmsDir} 0755 ${user} ${group} -"
      ];

      # Additional sudo rules for cloud VM provisioning
      security.sudo.extraRules = [{
        users = [ user ];
        commands = [
          # TAP interface management for cloud VMs
          { command = "/run/current-system/sw/bin/ip tuntap add * mode tap user *"; options = [ "NOPASSWD" ]; }
          { command = "/run/current-system/sw/bin/ip tuntap del * mode tap"; options = [ "NOPASSWD" ]; }
          { command = "/run/current-system/sw/bin/ip link set * master ${cfg.bridgeInterface}"; options = [ "NOPASSWD" ]; }
          { command = "/run/current-system/sw/bin/ip link set * up"; options = [ "NOPASSWD" ]; }
          { command = "/run/current-system/sw/bin/ip link set * down"; options = [ "NOPASSWD" ]; }
        ];
      }];

      # Provisioning environment and PATH
      systemd.services.weaver = {
        environment = {
          PROVISIONING_ENABLED = "true";
          MICROVMS_DIR = cfg.microvmsDir;
          BRIDGE_GATEWAY = cfg.bridgeGateway;
          BRIDGE_INTERFACE = cfg.bridgeInterface;
          QEMU_BIN = "${pkgs.qemu}/bin/qemu-system-x86_64";
          QEMU_IMG_BIN = "${pkgs.qemu}/bin/qemu-img";
          IP_BIN = "/run/current-system/sw/bin/ip";
        }
        # UEFI is opt-in, and the backend reads its ABSENCE as "this host cannot do UEFI" — a
        # create with firmware = "uefi" then fails at the API with a message naming the fix,
        # instead of booting the guest on SeaBIOS where Windows 11 dies mid-install.
        # Both paths or neither: config.ts treats a half-configured pair as absent.
        // (lib.optionalAttrs cfg.uefi.enable (
          let
            # pkgs.OVMF.fd ships ONLY the plain pair — no .ms variants. The pre-enrolled build is
            # a different derivation (OVMFFull), and naming a `.ms` path inside the plain one
            # yields a store path that does not exist, which fails at QEMU start rather than at
            # eval. Select the PACKAGE, not just the filename.
            ovmf = if cfg.uefi.secureBootCapable then pkgs.OVMFFull.fd else pkgs.OVMF.fd;
            suffix = if cfg.uefi.secureBootCapable then ".ms" else "";
          in
          {
            OVMF_CODE_PATH = "${ovmf}/FV/OVMF_CODE${suffix}.fd";
            OVMF_VARS_PATH = "${ovmf}/FV/OVMF_VARS${suffix}.fd";
          }
        ))
        // (lib.optionalAttrs cfg.uefi.tpm {
          SWTPM_BIN = "${pkgs.swtpm}/bin/swtpm";
        })
        // (lib.optionalAttrs (cfg.uefi.virtioWinIso != null) {
          VIRTIO_WIN_ISO = toString cfg.uefi.virtioWinIso;
        });
        # Add tools needed for cloud VM provisioning to PATH
        path = [ pkgs.cdrkit pkgs.qemu ];
        # Ensure the bridge is up before weaver starts. Without these,
        # a rebuild after uninstall/reinstall can leave the bridge inactive
        # because WantedBy=network.target is only honored at boot.
        wants = [
          "${cfg.bridgeInterface}-netdev.service"
          "network-addresses-${cfg.bridgeInterface}.service"
        ];
        after = [
          "${cfg.bridgeInterface}-netdev.service"
          "network-addresses-${cfg.bridgeInterface}.service"
        ];
      };

      # Bridge networking for VM connectivity
      networking.bridges.${cfg.bridgeInterface}.interfaces = [];
      networking.interfaces.${cfg.bridgeInterface}.ipv4.addresses = [{
        address = cfg.bridgeGateway;
        prefixLength = 24;
      }];

      # NAT for VM internet access
      networking.nat = {
        enable = true;
        internalInterfaces = [ cfg.bridgeInterface ];
      };

      # IP forwarding
      boot.kernel.sysctl."net.ipv4.ip_forward" = 1;
    })
    # ── DNS Core ─────────────────────────────────────────────────────────────
    #
    # Weaver writes the zone as a dnsmasq hosts file; dnsmasq serves it and forwards the rest.
    # The two halves are deliberately separate units: the backend can regenerate the file at any
    # time without restarting the resolver, and the resolver survives a backend restart. A zone
    # that is only in memory disappears with the process that held it.
    (mkIf (cfg.enable && cfg.dns.enable) {
      # dnsmasq needs the file to exist before it starts, even empty — it refuses to start on a
      # missing addn-hosts path, and on a fresh host Weaver has not written one yet.
      systemd.tmpfiles.rules = [
        "f ${cfg.dataDir}/dns-hosts 0644 ${cfg.serviceUser} ${cfg.serviceGroup} -"
      ];

      systemd.services.weaver-dnsmasq = {
        description = "Weaver DNS Core — stub resolver for the ${cfg.dns.domain} zone";
        after = [ "network.target" ];
        wantedBy = [ "multi-user.target" ];

        serviceConfig = {
          Type = "simple";
          # --keep-in-foreground: systemd owns the lifecycle, not dnsmasq's own forking.
          # --no-resolv + explicit --server: never inherit the host resolv.conf, or the stub can
          #   end up forwarding to itself and answering its own queries in a loop.
          # --bind-interfaces + --listen-address: bound to the bridge only. An open resolver on a
          #   LAN interface is an amplification reflector AND lets anything on the network
          #   enumerate the workloads by name.
          ExecStart = concatStringsSep " " ([
            cfg.dns.dnsmasqBin
            "--keep-in-foreground"
            "--no-resolv"
            "--no-hosts"
            "--bind-interfaces"
            "--addn-hosts=${cfg.dataDir}/dns-hosts"
            "--local=/${cfg.dns.domain}/"
            "--domain=${cfg.dns.domain}"
          ]
          ++ map (i: "--interface=${i}")
               (if cfg.dns.listenInterfaces == [ ] then [ cfg.bridgeInterface ] else cfg.dns.listenInterfaces)
          ++ map (s: "--server=${s}") cfg.dns.upstream);

          # SIGHUP makes dnsmasq re-read addn-hosts without dropping its cache or its socket.
          ExecReload = "${pkgs.coreutils}/bin/kill -HUP $MAINPID";
          Restart = "on-failure";
          RestartSec = 5;

          # It only needs to bind :53 on the bridge and read one file.
          DynamicUser = false;
          User = "dnsmasq";
          Group = "dnsmasq";
          AmbientCapabilities = [ "CAP_NET_BIND_SERVICE" ];
          CapabilityBoundingSet = [ "CAP_NET_BIND_SERVICE" ];
          NoNewPrivileges = true;
          PrivateTmp = true;
          ProtectSystem = "strict";
          ProtectHome = true;
          ReadOnlyPaths = [ cfg.dataDir ];
        };
      };

      users.users.dnsmasq = {
        isSystemUser = true;
        group = "dnsmasq";
        description = "Weaver DNS Core resolver";
      };
      users.groups.dnsmasq = { };

      # The backend needs to know the domain it is generating for, and how to ask the resolver to
      # reload. Without the reload command the zone file is written and nothing reads it — which
      # is exactly the inert state this block exists to end.
      systemd.services.weaver.environment = {
        DNS_DOMAIN = cfg.dns.domain;
        DNS_RELOAD_COMMAND = "/run/current-system/sw/bin/systemctl reload weaver-dnsmasq.service";
      };

      security.sudo.extraRules = [{
        users = [ cfg.serviceUser ];
        commands = [
          { command = "/run/current-system/sw/bin/systemctl reload weaver-dnsmasq.service"; options = [ "NOPASSWD" ]; }
        ];
      }];

      networking.firewall.interfaces = listToAttrs (map (i: {
        name = i;
        value = { allowedUDPPorts = [ 53 ]; allowedTCPPorts = [ 53 ]; };
      }) (if cfg.dns.listenInterfaces == [ ] then [ cfg.bridgeInterface ] else cfg.dns.listenInterfaces));
    })

    # ── Prometheus: the metrics store ────────────────────────────────────────────────────────
    #
    # Weaver's backend exposes `/metrics` in-process; this is the thing that scrapes it. The two
    # halves ship together so a host that installs Weaver has working graphs without a second
    # decision — the credibility gap this feature exists for is not closed by a stack the user has
    # to go and assemble.
    #
    # Written to COEXIST with an operator who already runs Prometheus rather than to own it:
    #
    #   * `scrapeConfigs` is a list, so this job merges alongside theirs instead of replacing it.
    #   * everything an operator plausibly owns — retention, port, listen address — is `mkDefault`,
    #     so their setting wins silently instead of throwing a conflict at eval time. A module that
    #     fights the host config gets removed from the host config.
    #
    # Nothing here is firewalled open. Prometheus binds loopback by default, and the scrape target
    # is `127.0.0.1`, which is also what satisfies the exporter's own loopback check — a same-host
    # scraper is the shape this is designed around, not a limitation being worked around.
    (mkIf (cfg.enable && cfg.metrics.enable) {
      services.prometheus = {
        enable = true;
        port = mkDefault cfg.metrics.port;
        listenAddress = mkDefault cfg.metrics.listenAddress;
        retentionTime = mkDefault cfg.metrics.retention;

        scrapeConfigs = [{
          job_name = "weaver";
          # 30s matches the in-process collector's sampling interval. A faster scrape would not
          # produce finer data — the cgroup counters are read at scrape time, but the UI contract
          # and the existing buffer are both built on 30s — and a slower one would leave gaps the
          # chart would have to render as absent readings.
          scrape_interval = "30s";
          static_configs = [{
            targets = [ "127.0.0.1:${toString cfg.port}" ];
            labels = { instance = config.networking.hostName; };
          }];
        }];
      };

      # Tell the backend where to READ history from. Without this the module
      # would run a Prometheus that nothing queries: the exporter feeds it, it retains samples
      # across restarts, and the UI keeps serving the in-process ring buffer that phase 4 deletes.
      #
      # Derived from the same two options the server is configured with, never restated — a
      # literal `127.0.0.1:9090` here would silently point at nothing the moment an operator
      # overrode either. `listenAddress` is `mkDefault`, so their value is what appears below.
      #
      # An IPv6 listen address needs brackets in a URL; `0.0.0.0` and `::` mean "all interfaces"
      # to a listener but are not routable as destinations, so both are dialled as loopback.
      systemd.services.weaver.environment.PROMETHEUS_URL =
        let
          addr = cfg.metrics.listenAddress;
          host =
            if addr == "0.0.0.0" || addr == "" then "127.0.0.1"
            else if addr == "::" then "[::1]"
            else if lib.hasInfix ":" addr then "[${addr}]"
            else addr;
        in
        "http://${host}:${toString cfg.metrics.port}";

      # The scrape reaches Weaver over loopback, so the backend must actually be up for the target
      # to be anything other than `down`. Ordering only — Prometheus still starts, and reports the
      # target as down, if Weaver fails. That is the honest outcome: a scrape failure should look
      # like a scrape failure, not like a host with no workloads.
      systemd.services.prometheus = {
        after = [ "weaver.service" ];
        wants = [ "weaver.service" ];
      };
    })

  ]);
}
