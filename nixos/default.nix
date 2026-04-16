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
  options.services.weaver = {
    enable = mkEnableOption "Weaver web interface";

    port = mkOption {
      type = types.port;
      default = 3100;
      description = "Port for the dashboard API server";
    };

    host = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "Host to bind the API server to";
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
        Determines feature tier: free, premium, or enterprise.
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
      description = "HMAC secret for license key validation";
    };

    premiumEnabled = mkOption {
      type = types.bool;
      default = false;
      description = ''
        DEPRECATED: Use licenseKey instead.
        Enable premium features (VM provisioning).
        When true and no licenseKey is set, maps to premium tier.
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
        When set, premium+ users can use the server key instead of BYOK.
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

  };

  config = let
    # Only create a dedicated system user/group when using the defaults.
    # When serviceUser is overridden (e.g. to "mark" for dev), the user
    # is expected to already exist on the system.
    isDefaultUser = cfg.serviceUser == "weaver";
    isDefaultGroup = cfg.serviceGroup == "weaver";
    user = cfg.serviceUser;
    group = cfg.serviceGroup;
  in mkIf cfg.enable (mkMerge [
    # --- Base configuration (always applied) ---
    {
      # System user (only created when using the default dedicated user)
      users.users.${user} = mkIf isDefaultUser {
        isSystemUser = true;
        group = group;
        home = cfg.dataDir;
        createHome = true;
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

        # WeasyPrint available to all tiers for compliance PDF export
        path = [ pkgs.python3Packages.weasyprint ];

        environment = {
          NODE_ENV = "production";
          PORT = toString cfg.port;
          HOST = cfg.host;
          LOG_LEVEL = "info";
          HOME = cfg.dataDir;
          STATIC_DIR = "${cfg.package}/lib/weaver/frontend";
          DOCS_ROOT = "${cfg.package}/lib/weaver/docs";
          WEASYPRINT_BIN = cfg.weasyprintBin;
          PREMIUM_ENABLED = if cfg.premiumEnabled then "true" else "false";
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
        };
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
  ]);
}
