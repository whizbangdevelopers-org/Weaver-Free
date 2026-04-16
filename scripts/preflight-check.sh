#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

# Weaver Pre-Flight Check
#
# Verifies hardware and system readiness before installing Weaver.
# Zero dependencies beyond bash + coreutils + standard Linux tools.
#
# Usage:
#   ./scripts/preflight-check.sh              # Full check
#   ./scripts/preflight-check.sh --json       # JSON output
#   curl -fsSL <url>/preflight-check.sh | bash # Remote execution

set -euo pipefail

# ── Output format ─────────────────────────────────────────────────────

JSON_MODE=false
if [[ "${1:-}" == "--json" ]]; then
  JSON_MODE=true
fi

# ── Colors ────────────────────────────────────────────────────────────

if [[ -t 1 ]] && [[ "$JSON_MODE" == false ]]; then
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  BOLD='\033[1m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  GREEN='' RED='' YELLOW='' BOLD='' DIM='' RESET=''
fi

# ── Counters & results ────────────────────────────────────────────────

PASSED=0
WARNED=0
FAILED=0
declare -a RESULTS=()

pass() {
  local check="$1" detail="$2"
  PASSED=$((PASSED + 1))
  RESULTS+=("$(printf '{"check":"%s","status":"pass","detail":"%s","remediation":null}' "$check" "$detail")")
  if [[ "$JSON_MODE" == false ]]; then
    printf "${GREEN}[PASS]${RESET} %-35s %s\n" "$check" "$detail"
  fi
}

warn() {
  local check="$1" detail="$2" remediation="${3:-}"
  WARNED=$((WARNED + 1))
  RESULTS+=("$(printf '{"check":"%s","status":"warn","detail":"%s","remediation":"%s"}' "$check" "$detail" "$remediation")")
  if [[ "$JSON_MODE" == false ]]; then
    printf "${YELLOW}[WARN]${RESET} %-35s %s\n" "$check" "$detail"
    if [[ -n "$remediation" ]]; then
      printf "       ${DIM}→ %s${RESET}\n" "$remediation"
    fi
  fi
}

fail() {
  local check="$1" detail="$2" remediation="${3:-}"
  FAILED=$((FAILED + 1))
  RESULTS+=("$(printf '{"check":"%s","status":"fail","detail":"%s","remediation":"%s"}' "$check" "$detail" "$remediation")")
  if [[ "$JSON_MODE" == false ]]; then
    printf "${RED}[FAIL]${RESET} %-35s %s\n" "$check" "$detail"
    if [[ -n "$remediation" ]]; then
      printf "       ${DIM}→ %s${RESET}\n" "$remediation"
    fi
  fi
}

# ── Header ────────────────────────────────────────────────────────────

if [[ "$JSON_MODE" == false ]]; then
  echo ""
  printf "${BOLD}Weaver Pre-Flight Check${RESET}\n"
  echo "========================"
  echo ""
fi

# ── 1. CPU Architecture ──────────────────────────────────────────────

ARCH=$(uname -m)
case "$ARCH" in
  x86_64)
    pass "Architecture" "$ARCH"
    ;;
  aarch64)
    warn "Architecture" "$ARCH (experimental — community support only)" \
      "aarch64 dashboard works; MicroVM provisioning is experimental"
    ;;
  *)
    fail "Architecture" "$ARCH (unsupported)" \
      "Weaver requires x86_64 or aarch64. See docs/COMPATIBILITY.md"
    ;;
esac

# ── 2. CPU Virtualization Extensions ─────────────────────────────────

if [[ -r /proc/cpuinfo ]]; then
  VIRT_COUNT=$(grep -cE 'vmx|svm' /proc/cpuinfo 2>/dev/null || echo 0)
  if [[ "$VIRT_COUNT" -gt 0 ]]; then
    if grep -q 'vmx' /proc/cpuinfo 2>/dev/null; then
      pass "CPU virtualization" "Intel VT-x detected ($VIRT_COUNT logical CPUs)"
    else
      pass "CPU virtualization" "AMD-V (SVM) detected ($VIRT_COUNT logical CPUs)"
    fi
  else
    # Check if we're inside a VM that hides flags
    HYPERVISOR=$(grep -oP 'Hypervisor vendor:\s*\K.*' /proc/cpuinfo 2>/dev/null || \
                 systemd-detect-virt 2>/dev/null || echo "")
    if [[ -n "$HYPERVISOR" && "$HYPERVISOR" != "none" ]]; then
      fail "CPU virtualization" "Not detected (running inside VM: $HYPERVISOR)" \
        "Enable nested virtualization on the host. For KVM: modprobe kvm_intel nested=1. For Proxmox: set cpu type to 'host'"
    else
      fail "CPU virtualization" "VT-x/AMD-V not detected in /proc/cpuinfo" \
        "Enable virtualization in BIOS. Intel: look for VT-x or Virtualization Technology. AMD: look for SVM Mode. See docs/COMPATIBILITY.md § BIOS Configuration"
    fi
  fi
else
  fail "CPU virtualization" "/proc/cpuinfo not readable" \
    "Cannot determine CPU features. Ensure /proc is mounted"
fi

# ── 3. KVM Module ────────────────────────────────────────────────────

if lsmod 2>/dev/null | grep -q '^kvm'; then
  KVM_MOD=$(lsmod | grep '^kvm' | awk '{print $1}' | tr '\n' ', ' | sed 's/,$//')
  pass "KVM module" "Loaded ($KVM_MOD)"
else
  if [[ -e /dev/kvm ]]; then
    # Module might be built-in
    pass "KVM module" "Built-in (/dev/kvm exists without module)"
  else
    fail "KVM module" "Not loaded" \
      "Run: modprobe kvm_intel (Intel) or modprobe kvm_amd (AMD). For NixOS: boot.kernelModules = [ \"kvm-intel\" ];"
  fi
fi

# ── 4. /dev/kvm Access ──────────────────────────────────────────────

if [[ -e /dev/kvm ]]; then
  if [[ -r /dev/kvm && -w /dev/kvm ]]; then
    pass "/dev/kvm" "Accessible (read/write)"
  elif [[ -r /dev/kvm ]]; then
    warn "/dev/kvm" "Read-only access" \
      "Add your user to the 'kvm' group: sudo usermod -aG kvm \$USER (then re-login)"
  else
    fail "/dev/kvm" "Exists but not accessible to current user" \
      "Add your user to the 'kvm' group: sudo usermod -aG kvm \$USER (then re-login)"
  fi
else
  fail "/dev/kvm" "Device not found" \
    "Load KVM module first. VMs will run 10-50x slower without KVM (QEMU TCG fallback)"
fi

# ── 5. IOMMU (Device Passthrough) ───────────────────────────────────

IOMMU_DETECTED=false
if [[ -d /sys/class/iommu ]] && [[ -n "$(ls -A /sys/class/iommu 2>/dev/null)" ]]; then
  IOMMU_DETECTED=true
fi

if [[ "$IOMMU_DETECTED" == true ]]; then
  IOMMU_GROUPS=$(find /sys/kernel/iommu_groups/ -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l)
  pass "IOMMU" "Active ($IOMMU_GROUPS groups detected)"
else
  # Check dmesg for hints
  IOMMU_DMESG=$(dmesg 2>/dev/null | grep -ci iommu || true)
  IOMMU_DMESG="${IOMMU_DMESG:-0}"
  IOMMU_DMESG=$(echo "$IOMMU_DMESG" | tr -d '[:space:]')
  if [[ "$IOMMU_DMESG" -gt 0 ]] 2>/dev/null; then
    warn "IOMMU" "References in dmesg but not fully active" \
      "Add intel_iommu=on or amd_iommu=on to kernel boot params. NixOS: boot.kernelParams = [ \"intel_iommu=on\" ];"
  else
    warn "IOMMU" "Not detected (device passthrough unavailable)" \
      "Enable VT-d (Intel) or AMD-Vi in BIOS, then add iommu=on to kernel params. Not required for basic VM provisioning"
  fi
fi

# ── 6. Nested Virtualization ─────────────────────────────────────────

VIRT_TYPE=$(systemd-detect-virt 2>/dev/null || echo "none")
VIRT_TYPE=$(echo "$VIRT_TYPE" | head -1 | tr -d '[:space:]')
if [[ "$VIRT_TYPE" != "none" && "$VIRT_TYPE" != "" ]]; then
  # We're inside a VM — check if nested virt works
  if [[ -e /dev/kvm ]]; then
    pass "Nested virtualization" "Running inside $VIRT_TYPE with KVM access"
  else
    fail "Nested virtualization" "Running inside $VIRT_TYPE but /dev/kvm not available" \
      "Enable nested virtualization on the host hypervisor. KVM: echo 1 > /sys/module/kvm_intel/parameters/nested"
  fi
else
  pass "Nested virtualization" "Bare metal (not applicable)"
fi

# ── 7. RAM ───────────────────────────────────────────────────────────

if command -v free &>/dev/null; then
  TOTAL_MB=$(free -m | awk '/^Mem:/ {print $2}')
  if [[ "$TOTAL_MB" -ge 2048 ]]; then
    pass "RAM" "${TOTAL_MB} MB (minimum: 2048 MB for provisioning)"
  elif [[ "$TOTAL_MB" -ge 1024 ]]; then
    warn "RAM" "${TOTAL_MB} MB (dashboard OK, provisioning needs 2048+ MB)" \
      "Add more RAM if you plan to provision MicroVMs"
  else
    fail "RAM" "${TOTAL_MB} MB (minimum: 1024 MB)" \
      "Weaver dashboard requires at least 1 GB RAM"
  fi
else
  warn "RAM" "Cannot determine (free command not available)"
fi

# ── 8. Disk Space ────────────────────────────────────────────────────

if command -v df &>/dev/null; then
  AVAIL_MB=$(df -m / | awk 'NR==2 {print $4}')
  if [[ "$AVAIL_MB" -ge 5120 ]]; then
    pass "Disk space" "${AVAIL_MB} MB available on / (minimum: 500 MB)"
  elif [[ "$AVAIL_MB" -ge 500 ]]; then
    warn "Disk space" "${AVAIL_MB} MB available (low for VM images)" \
      "VM disk images need additional space. Consider 10+ GB free for provisioning"
  else
    fail "Disk space" "${AVAIL_MB} MB available (minimum: 500 MB)" \
      "Free up disk space before installing Weaver"
  fi
else
  warn "Disk space" "Cannot determine (df command not available)"
fi

# ── 9. Operating System ──────────────────────────────────────────────

if command -v nixos-version &>/dev/null; then
  NIXOS_VER=$(nixos-version 2>/dev/null || echo "unknown")
  # Extract major.minor (e.g., "25.11" from "25.11.717285.abc123")
  NIXOS_MAJOR_MINOR=$(echo "$NIXOS_VER" | grep -oP '^\d+\.\d+' || echo "")
  if [[ -n "$NIXOS_MAJOR_MINOR" ]]; then
    # Compare: minimum is 25.11
    MAJOR=$(echo "$NIXOS_MAJOR_MINOR" | cut -d. -f1)
    MINOR=$(echo "$NIXOS_MAJOR_MINOR" | cut -d. -f2)
    if [[ "$MAJOR" -gt 25 ]] || { [[ "$MAJOR" -eq 25 ]] && [[ "$MINOR" -ge 11 ]]; }; then
      pass "NixOS version" "$NIXOS_VER (minimum: 25.11)"
    else
      fail "NixOS version" "$NIXOS_VER (minimum: 25.11)" \
        "Upgrade to NixOS 25.11+. See nixos.org/manual for upgrade instructions"
    fi
  else
    warn "NixOS version" "$NIXOS_VER (could not parse version number)"
  fi
elif [[ -f /etc/os-release ]]; then
  OS_NAME=$(. /etc/os-release && echo "${PRETTY_NAME:-$ID}")
  warn "Operating system" "$OS_NAME (not NixOS)" \
    "Weaver is designed for NixOS. Non-NixOS deployment requires manual setup. See docs/PRODUCTION-DEPLOYMENT.md"
else
  warn "Operating system" "Cannot determine OS"
fi

# ── 10. Bridge Kernel Module ─────────────────────────────────────────

if lsmod 2>/dev/null | grep -q '^bridge'; then
  pass "Bridge kernel module" "Loaded"
elif modprobe -n bridge 2>/dev/null; then
  warn "Bridge kernel module" "Available but not loaded" \
    "Will be loaded automatically when bridge interface is created"
else
  warn "Bridge kernel module" "Cannot verify (modprobe not available or not root)" \
    "Bridge module is typically built-in or auto-loaded on NixOS"
fi

# ── 11. QEMU ─────────────────────────────────────────────────────────

if command -v qemu-system-x86_64 &>/dev/null; then
  QEMU_VER=$(qemu-system-x86_64 --version 2>/dev/null | head -1 || echo "unknown")
  pass "QEMU" "$QEMU_VER"
elif command -v qemu-system-aarch64 &>/dev/null; then
  QEMU_VER=$(qemu-system-aarch64 --version 2>/dev/null | head -1 || echo "unknown")
  pass "QEMU" "$QEMU_VER (aarch64)"
else
  warn "QEMU" "Not found in PATH" \
    "QEMU is provided automatically by the NixOS module. Only needed if provisioning MicroVMs"
fi

# ── 12. Network IP Forwarding ────────────────────────────────────────

if [[ -r /proc/sys/net/ipv4/ip_forward ]]; then
  IP_FWD=$(cat /proc/sys/net/ipv4/ip_forward)
  if [[ "$IP_FWD" == "1" ]]; then
    pass "IP forwarding" "Enabled"
  else
    warn "IP forwarding" "Disabled" \
      "Required for VM network access. NixOS: boot.kernel.sysctl.\"net.ipv4.ip_forward\" = 1;"
  fi
else
  warn "IP forwarding" "Cannot determine (/proc/sys/net/ipv4/ip_forward not readable)"
fi

# ── Summary ──────────────────────────────────────────────────────────

TOTAL=$((PASSED + WARNED + FAILED))

if [[ "$JSON_MODE" == true ]]; then
  # Build JSON array from results
  echo "{"
  echo "  \"tool\": \"weaver-preflight\","
  echo "  \"version\": \"1.0.0\","
  echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"summary\": {"
  echo "    \"total\": $TOTAL,"
  echo "    \"passed\": $PASSED,"
  echo "    \"warned\": $WARNED,"
  echo "    \"failed\": $FAILED,"
  echo "    \"result\": \"$(if [[ $FAILED -gt 0 ]]; then echo "fail"; elif [[ $WARNED -gt 0 ]]; then echo "warn"; else echo "pass"; fi)\""
  echo "  },"
  echo "  \"checks\": ["
  for i in "${!RESULTS[@]}"; do
    if [[ $i -gt 0 ]]; then echo ","; fi
    printf "    %s" "${RESULTS[$i]}"
  done
  echo ""
  echo "  ]"
  echo "}"
else
  echo ""
  echo "────────────────────────────────────────"
  printf "${BOLD}Result:${RESET} "
  printf "${GREEN}%d passed${RESET}, " "$PASSED"
  printf "${YELLOW}%d warnings${RESET}, " "$WARNED"
  printf "${RED}%d failed${RESET}\n" "$FAILED"
  echo ""

  if [[ $FAILED -gt 0 ]]; then
    printf "${RED}${BOLD}Pre-flight check failed.${RESET} Resolve the failures above before installing Weaver.\n"
    echo "For BIOS configuration help, see: docs/COMPATIBILITY.md § BIOS Configuration Reference"
  elif [[ $WARNED -gt 0 ]]; then
    printf "${YELLOW}${BOLD}Pre-flight check passed with warnings.${RESET} Weaver will install but some features may be limited.\n"
  else
    printf "${GREEN}${BOLD}All checks passed.${RESET} System is ready for Weaver installation.\n"
  fi
  echo ""
fi

# Exit code
if [[ $FAILED -gt 0 ]]; then
  exit 1
else
  exit 0
fi
