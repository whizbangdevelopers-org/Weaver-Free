<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div class="text-h4 q-mb-lg">
      <q-icon name="mdi-help-circle" class="q-mr-sm" />
      Help
    </div>

    <!-- Search -->
    <q-input
      v-model="searchQuery"
      outlined
      dense
      placeholder="Search help topics..."
      class="q-mb-lg"
      style="max-width: 500px"
      clearable
    >
      <template #prepend>
        <q-icon name="mdi-magnify" />
      </template>
    </q-input>

    <!-- Organization contact info -->
    <q-banner v-if="orgContactEmail || orgContactPhone" class="q-mb-lg bg-blue-1" rounded style="max-width: 800px">
      <template #avatar>
        <q-icon name="mdi-headset" color="primary" />
      </template>
      <div class="text-body2">
        <span class="text-weight-medium">Need help from your administrator?</span>
        <span v-if="orgContactEmail" class="q-ml-sm">
          <q-icon name="mdi-email" size="14px" class="q-mr-xs" />
          <a :href="'mailto:' + orgContactEmail">{{ orgContactEmail }}</a>
        </span>
        <span v-if="orgContactPhone" class="q-ml-sm">
          <q-icon name="mdi-phone" size="14px" class="q-mr-xs" />
          {{ orgContactPhone }}
        </span>
      </div>
    </q-banner>

    <!-- Help sections -->
    <div class="q-gutter-md" style="max-width: 800px">
      <q-card
        v-for="section in filteredSections"
        :key="section.id"
        flat
        bordered
      >
        <q-expansion-item
          :icon="section.icon"
          :label="section.title"
          :caption="section.caption"
          header-class="text-h6"
        >
          <q-card-section>
            <q-list separator>
              <q-item
                v-for="item in section.items"
                :key="item.question"
                class="q-py-md"
              >
                <q-item-section>
                  <q-item-label class="text-subtitle1 text-weight-medium q-mb-xs">
                    {{ item.question }}
                  </q-item-label>
                  <q-item-label class="text-body2 text-grey-8">
                    {{ item.answer }}
                  </q-item-label>
                  <div v-if="item.steps" class="q-mt-sm">
                    <ol class="q-pl-md q-my-none">
                      <li
                        v-for="(step, i) in item.steps"
                        :key="i"
                        class="text-body2 text-grey-8 q-mb-xs"
                      >
                        {{ step }}
                      </li>
                    </ol>
                  </div>
                  <q-btn
                    v-if="item.link"
                    flat
                    dense
                    color="primary"
                    :label="item.linkLabel || 'Go'"
                    :icon="item.linkIcon || 'mdi-arrow-right'"
                    class="q-mt-sm"
                    :to="item.link"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-expansion-item>
      </q-card>

      <!-- No results -->
      <div v-if="filteredSections.length === 0" class="text-center q-pa-xl">
        <q-icon name="mdi-magnify" size="48px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-8">No matching help topics</div>
        <div class="text-caption text-grey-8 q-mt-sm">
          Try a different search term.
        </div>
      </div>

      <!-- Copyright -->
      <div class="text-caption text-grey-8 q-mt-xl q-pt-md" style="max-width: 800px">
        &copy; {{ new Date().getFullYear() }} whizBANG Developers LLC. All rights reserved.
        Licensed under AGPL-3.0 with Commons Clause.
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from 'src/stores/app'
import { isDemoMode } from 'src/config/demo-mode'
import { PRICING, formatPricing } from 'src/constants/pricing'

const appStore = useAppStore()
const orgContactEmail = computed(() => appStore.organization?.contactEmail ?? '')
const orgContactPhone = computed(() => appStore.organization?.contactPhone ?? '')

/** Version label: demo-aware (matches DocsPage pattern). */
const appVersion = computed(() =>
  isDemoMode() ? appStore.demoVersion + '.0' : __APP_VERSION__
)

interface HelpItem {
  question: string
  answer: string
  steps?: string[]
  link?: string
  linkLabel?: string
  linkIcon?: string
  /** Minimum product version required to show this item. Defaults to '1.0' if omitted. */
  minVersion?: string
}

interface HelpSection {
  id: string
  title: string
  caption: string
  icon: string
  items: HelpItem[]
}

function isVersionVisible(minVersion?: string): boolean {
  if (!minVersion) return true
  if (isDemoMode()) return appStore.isDemoVersionAtLeast(minVersion)
  const parse = (v: string) => {
    const [maj, min] = v.replace(/^v/, '').split('.').map(Number)
    return (maj ?? 0) * 100 + (min ?? 0)
  }
  return parse(__APP_VERSION__) >= parse(minVersion)
}

const searchQuery = ref('')

const helpSections = computed<HelpSection[]>(() => [
  {
    id: 'documentation',
    title: 'Documentation',
    caption: 'Full admin and user guides',
    icon: 'mdi-book-open-variant',
    items: [
      {
        question: `Admin Guide v${appVersion.value}`,
        answer:
          'Complete operations manual for Weaver administrators — user management, license configuration, network management, AI agent setup, backup, security, and more.',
        link: '/docs/admin-guide',
        linkLabel: 'Open Admin Guide',
        linkIcon: 'mdi-book-cog',
      },
      {
        question: `User Guide v${appVersion.value}`,
        answer:
          'Daily usage guide for operators and viewers — navigating the UI, workload management, Shed, serial console, AI diagnostics, topology, keyboard shortcuts, and TUI.',
        link: '/docs/user-guide',
        linkLabel: 'Open User Guide',
        linkIcon: 'mdi-book-account',
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    caption: 'First steps with Weaver',
    icon: 'mdi-rocket-launch',
    items: [
      {
        question: 'What is Weaver?',
        answer:
          'Weaver is a web-based management interface for workloads running on NixOS hosts. It manages MicroVMs (hardware-isolated virtual machines) and containers (Docker, Podman, Apptainer) from a single interface. See the User Guide in the Docs tab for a full walkthrough of every page and feature.',
      },
      {
        question: 'How do I create my first VM?',
        answer: 'Weaver supports two approaches to MicroVMs. On all tiers, you can define MicroVMs in your NixOS configuration and use Weaver to monitor and control them — this path offers lighter hypervisors and declarative reproducibility. On Weaver Solo+, Live Provisioning lets you create MicroVMs with any guest OS directly from the Shed page — no rebuild, no terminal. With a Solo or higher license, a lightweight CirOS example VM (~20 MB) is auto-provisioned after your first admin login. See the Admin Guide in the Docs tab for details on both approaches.',
        link: '/shed',
        linkLabel: 'Go to Shed',
        linkIcon: 'mdi-door-open',
      },
      {
        question: 'What distributions are supported?',
        answer:
          'Built-in distributions include Arch Linux, Fedora, Ubuntu, Debian, and Alpine. Cloud distros use QEMU with cloud images and cloud-init. ISO distros boot from a downloaded ISO for manual installation (e.g. Windows). You can also add custom distributions in Settings.',
        link: '/settings',
        linkLabel: 'Manage Distributions',
        linkIcon: 'mdi-cog',
      },
    ],
  },
  {
    id: 'authentication',
    title: 'Authentication',
    caption: 'Login, accounts, and security',
    icon: 'mdi-shield-account',
    items: [
      {
        question: 'How do I log in?',
        answer:
          'Navigate to the login page and enter your username and password. If this is the first time Weaver is being set up, you will be prompted to create an admin account instead.',
      },
      {
        question: 'What is the first-run setup?',
        answer:
          'When no user accounts exist, the login page automatically switches to a "Create Admin Account" form. The first account created always receives admin privileges. After setup, subsequent users must be created by an admin.',
      },
      {
        question: 'How do I log out?',
        answer:
          'Click your username in the top-right corner of the header to open the user menu, then click "Logout". You will be redirected to the login page.',
      },
      {
        question: 'What happens if I forget my password?',
        answer:
          'Contact your administrator to reset your password. If you are the only admin and have root access on the host, see the Admin Guide in the Docs tab for the password reset procedure.',
      },
      {
        question: 'Why am I being redirected to the login page?',
        answer:
          'All pages require authentication. Access tokens expire after 15 minutes and are refreshed automatically in the background. If your refresh token expires (after 7 days of inactivity) or you have been logged out, you will be redirected to log in again. Single-session enforcement is active — logging in from a new browser or TUI will revoke your previous session. Only one active session per user is allowed at any tier.',
      },
      {
        question: 'What are the user roles?',
        answer:
          'There are four roles: Admin (full access including deleting VMs, managing distributions, and managing users), Operator (can start/stop/restart VMs, register new VMs, and refresh the distro catalog), Viewer (read-only access to the Weaver page, network topology, and AI diagnostics), and Auditor (read-only access plus audit log viewing). Your current role is shown as a badge next to your username in the header. See the Admin Guide in the Docs tab for full role details.',
      },
      {
        question: 'Why can\'t I see certain buttons?',
        answer:
          'Weaver hides actions you do not have permission to perform. Viewers cannot see Start/Stop/Restart, Create VM, or Delete buttons. Operators cannot see the Delete button. If you need elevated permissions, contact your administrator.',
      },
      {
        question: 'How do I manage user accounts?',
        answer:
          'Admins can access the Users page from the sidebar. From there you can view all registered users, change roles using the dropdown (admin, operator, viewer, auditor), and delete user accounts. You cannot delete your own account or demote the last remaining admin. See the Admin Guide in the Docs tab for user capacity per tier and advanced features like per-workload access control.',
        link: '/users',
        linkLabel: 'Go to Users',
        linkIcon: 'mdi-account-group',
      },
      {
        question: 'What happens when I change a user\'s role?',
        answer:
          'The role change takes effect immediately. The affected user\'s active sessions are invalidated, requiring them to log in again with their new permissions.',
      },
    ],
  },
  {
    id: 'vm-management',
    title: 'Workload Management',
    caption: 'Starting, stopping, and monitoring workloads',
    icon: 'mdi-server',
    items: [
      {
        question: 'How do I add a VM to Weaver?',
        answer:
          'There are three ways to add workloads to Weaver. See the Admin Guide in the Docs tab for details on each approach.',
        steps: [
          'Scan for Workloads: Discovers NixOS-declared MicroVMs (microvm@* systemd services) and containers on your host. Available from the Weaver page or Settings.',
          'Register Existing: Manually register a workload that Weaver didn\'t auto-discover. For workloads managed outside Weaver that you want to monitor.',
          'Live Provisioning (Weaver Solo+): Create MicroVMs from the Shed page with any guest OS — no terminal, no nixos-rebuild.',
        ],
        link: '/shed',
        linkLabel: 'Go to Shed',
        linkIcon: 'mdi-door-open',
      },
      {
        question: 'How do I delete a workload?',
        answer:
          'Click the delete button (trash icon) on the workload card or detail page. You will be asked to confirm. Deleting a workload removes its registration and cleans up provisioned resources. Requires Admin role on paid tiers.',
      },
      {
        question: 'How do I start or stop a workload?',
        answer:
          'Use the action buttons on each workload card or the detail page. Running workloads show a Stop button; stopped workloads show a Start button. You can also Restart running workloads. See the User Guide in the Docs tab for the full list of actions by role.',
      },
      {
        question: 'What do the status badges mean?',
        answer:
          'Running (green): workload is active. Stopped (grey): not running. Failed (red): encountered an error. Provisioning (blue): being created. Destroying (orange): being removed. Unknown (yellow): status could not be determined. Registered (grey): tracked but not yet started. See the User Guide in the Docs tab for full details.',
      },
      {
        question: 'What are the hypervisor options?',
        answer:
          'QEMU is the most versatile and supports all distributions, desktop mode, and cloud images. Cloud Hypervisor, crosvm, kvmtool, and Firecracker are lighter alternatives for NixOS-declared MicroVMs only (Firecracker does not support virtiofs/9p shared filesystems). See the Admin Guide in the Docs tab for a comparison table.',
      },
      {
        question: 'What is desktop mode?',
        answer:
          'Desktop mode (QEMU only) provisions the VM with VGA graphics and a VNC display. It is useful for graphical operating systems or when you need a full desktop environment.',
      },
      {
        question: 'How do I access the serial console?',
        answer:
          'Open a running VM\'s detail page and click the Console tab. The serial console provides a terminal interface to the VM. The VM must be running to use the console.',
      },
      {
        question: 'How do I sort or reorder workload cards?',
        answer:
          'Use the sort dropdown (next to the grid/list toggle) to sort workloads by name, status, or a custom manual order. Select "Manual (drag)" to enable drag-and-drop — drag handles appear on each card. Drag cards to your preferred arrangement and the order persists across sessions in browser localStorage.',
      },
      {
        question: 'Are there keyboard shortcuts?',
        answer:
          'Yes. Global keyboard shortcuts let you navigate quickly without clicking. Shortcuts are ignored when focus is in a text input, textarea, or dropdown.',
        steps: [
          '? — Open this Help page',
          'd — Go to Weaver',
          's — Go to Settings',
          't — Go to Strands',
          'n — Create a new VM',
        ],
      },
      {
        question: 'Is there a terminal (TUI) client?',
        answer:
          'Yes. Weaver includes a terminal-based interface for managing workloads over SSH without a browser. It mirrors all web UI features with keyboard-driven navigation. See the User Guide in the Docs tab for full TUI documentation.',
        steps: [
          'Prerequisite: Complete the initial admin setup via the web UI before using the TUI',
          'Keyboard: arrows/j/k to navigate, s/S/r for start/stop/restart, d for detail, a for AI agent, q to quit',
          'Credentials are stored in ~/.config/weaver/',
        ],
      },
      {
        question: 'How do I run a Windows guest?',
        answer:
          'Windows guests use a "Bring Your Own ISO" approach. Add a custom distro in Settings with your Windows ISO URL and set Guest OS to "Windows". When creating a VM, select the Windows distro — QEMU and desktop mode (VNC) are automatically enabled. Install Windows manually via the VNC console. Use Windows 10 or Server 2016+ (Windows 11 requires UEFI, which is not yet supported). Windows VMs use IDE disk and e1000 networking for driver-free installation.',
        steps: [
          'Go to Settings and add a custom distro with your Windows ISO URL, set Guest OS to Windows',
          'Create a new VM and select your Windows distro from the dropdown',
          'The VM will be provisioned with a blank disk and your ISO attached',
          'Start the VM and access the VNC console to install Windows',
        ],
      },
    ],
  },
  {
    id: 'ai-features',
    title: 'AI Features',
    caption: 'AI-powered diagnostics and analysis',
    icon: 'mdi-robot',
    items: [
      {
        question: 'What AI features are available?',
        answer:
          'Three AI-powered actions are available per workload: Diagnose (analyze issues and suggest fixes), Explain (describe what the workload does and its configuration), and Suggest (recommend optimizations). See the Admin Guide in the Docs tab for configuration details and rate limits.',
      },
      {
        question: 'How do I use AI diagnostics?',
        answer: 'There are several ways to trigger AI analysis.',
        steps: [
          'Click the stethoscope icon on any workload card for a quick Diagnose.',
          'Open a workload detail page and use the Diagnose, Explain, or Suggest buttons.',
          'View past AI analyses in the AI Analysis tab.',
        ],
      },
      {
        question: 'Do I need an API key?',
        answer:
          'Not necessarily. Without an API key, AI features use mock mode with sample responses — great for evaluation. For real AI analysis, configure an API key in Settings.',
        link: '/settings',
        linkLabel: 'Configure API Key',
        linkIcon: 'mdi-key',
      },
      {
        question: 'What is BYOK (Bring Your Own Key)?',
        answer:
          'BYOK lets you use your own API key instead of a server-configured one. Your key is stored exclusively in your browser — Weaver never sees, transmits, or stores it. You are responsible for your key\'s security, all costs incurred through its use, and compliance with your API provider\'s terms of service. Use a dedicated key with spending caps and restricted permissions. Do not enter keys on shared or public devices. Weaver Solo+ tiers include a server-side credential vault as a managed alternative.',
      },
      {
        question: 'Why do I need to provide my own API key?',
        answer:
          'If your administrator has configured a server-side AI key, it is available to Weaver Solo+ license holders. Free-tier users must provide their own API key in Settings > AI Provider.',
      },
      {
        question: 'What are the AI agent rate limits?',
        answer:
          'Every AI agent request consumes resources — API tokens for cloud providers (Anthropic, OpenAI), GPU compute for self-hosted models (vLLM, TGI), or host CPU/RAM for local models (Ollama). Weaver enforces per-user rate limits to protect your AI infrastructure: Free = 5/min, Weaver Solo/Team = 10/min, FabricK = 30/min.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & Configuration',
    caption: 'Customizing your Weaver experience',
    icon: 'mdi-cog',
    items: [
      {
        question: 'Where are my settings stored?',
        answer:
          'All user settings (API keys, preferences, tooltip toggles) are stored in your browser\'s localStorage. They persist across sessions but are specific to each browser.',
      },
      {
        question: 'How do I add a custom distribution?',
        answer: 'Custom cloud image distributions can be added in Settings. You can use a remote download URL (https://...) or point to a local file already on the server (file:///path/to/image.qcow2). Local paths are useful when you have ISOs or images downloaded separately — no browser upload needed.',
        steps: [
          'Go to Settings.',
          'Scroll to the Custom Distributions section.',
          'Click "Add custom distribution".',
          'Enter the short name, full name, image URL or local path, format, and whether it supports cloud-init.',
          'Click "Add Distribution".',
        ],
        link: '/settings',
        linkLabel: 'Go to Settings',
        linkIcon: 'mdi-cog',
      },
      {
        question: 'How do I manage tags across workloads?',
        answer:
          'Admins can manage tags centrally in Settings under "Tag Management". This section shows all tags in use with workload counts. You can rename a tag across all workloads or delete a tag from all workloads in bulk. For per-workload tag editing, use the tag editor on the detail page.',
        link: '/settings',
        linkLabel: 'Go to Settings',
        linkIcon: 'mdi-tag-multiple',
      },
      {
        question: 'What is the Host Information strip on the Weaver page?',
        answer:
          'The Host Information strip shows basic facts about the NixOS machine running Weaver: hostname, IP address, CPU core count, total RAM, and whether KVM hardware acceleration is available. The host IP also appears on Strands. KVM status matters because VMs run significantly slower without it. If KVM is not detected, a warning banner appears. Weaver Solo+ admins can view detailed host metrics (CPU topology, disk usage, network interfaces, live load) in Settings > Host Information.',
      },
      {
        question: 'What is the Host Configuration viewer in Settings?',
        answer:
          'The Host Configuration viewer (Settings > Host Configuration) shows a read-only view of the NixOS configuration.nix file that defines your host. Workload definitions are automatically categorized in the sidebar: MicroVMs (microvm.vms.*), OCI containers (virtualisation.oci-containers.containers.*), Slurm nodes (services.slurm.*), and the Infrastructure layer (networking, bridges, kernel modules). Click any section in the sidebar to jump to its definition. The viewer is available to all users at all tiers — no login privilege required beyond authentication. Editing the configuration file requires a NixOS rebuild and is done outside of Weaver.',
      },
      {
        question: 'How do I toggle contextual help tooltips?',
        answer:
          'Go to Settings and find the Help Preferences section. Toggle "Show contextual help tooltips" on or off. When disabled, the small help icons next to form fields and buttons will be hidden.',
        link: '/settings',
        linkLabel: 'Go to Settings',
        linkIcon: 'mdi-cog',
      },
      {
        question: 'What is audit logging?',
        answer:
          'Weaver records significant user actions in an audit log, including logins, workload operations (start, stop, restart, create, delete), AI agent runs, and distro management. Audit entries capture who performed the action, when, what resource was affected, and whether it succeeded. On FabricK tier, admins can browse the audit log on the Audit Log page with filters for date range, action type, user, and resource. See the Admin Guide in the Docs tab for full details.',
        link: '/audit',
        linkLabel: 'View Audit Log',
        linkIcon: 'mdi-text-box-search',
        minVersion: '3.3',
      },
      {
        question: 'How do I use the notification bell?',
        answer:
          'The bell icon in the toolbar shows a badge with the number of unread notifications. Click it to open the notification panel. From there you can mark individual notifications as read, dismiss them with the X button, or use checkboxes to select multiple notifications for bulk actions (mark read or delete). Use "Mark all read" to clear the badge count or "Clear all" to remove all notifications.',
      },
      {
        question: 'How do I set up push notifications?',
        answer:
          'Push notifications are a Weaver Solo+ feature. Admins can configure notification channels in Settings under the Notifications section. See the Admin Guide in the Docs tab for channel setup and event subscriptions.',
        steps: [
          'Go to Settings and scroll to the Notifications section.',
          'Click "Add Channel" to add a new notification channel.',
          'Select the channel type and fill in the required fields.',
          'Choose which events the channel should receive.',
          'Click "Add Channel" to save. Use the "Test" button to verify delivery.',
        ],
        link: '/settings',
        linkLabel: 'Go to Settings',
        linkIcon: 'mdi-cog',
      },
      {
        question: 'How do I export my VM configurations?',
        answer:
          'Weaver provides a free-tier API for exporting workload configurations as JSON. This is useful for version-controlling your VM definitions, migrating between hosts, or keeping an offline record of your setup.',
        steps: [
          'Export all workloads: curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/workload/export | jq .',
          'Export a single VM: curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/workload/web-nginx/export | jq .',
          'The export includes name, IP, memory, vCPUs, hypervisor, distribution, tags, and bridge configuration — everything needed to recreate the VM.',
          'Save the output to a file (e.g. my-vms.json) to keep a portable backup of your configurations.',
        ],
      },
      {
        question: 'What notification events are available?',
        answer:
          'Events are grouped into four categories: Workload events (started, stopped, failed, recovered), Provisioning events (provisioned, provision-failed), Resource alerts (high CPU, high memory), and Security events (auth failure, unauthorized access, permission denied). Session lifecycle events (login kick, logout) do not trigger security notifications. Each channel can subscribe to any combination of events.',
      },
      {
        question: 'How do webhook integrations work?',
        answer:
          'The webhook channel sends HTTP requests to your endpoint when subscribed events occur. Four payload formats are supported: JSON (raw event data), Slack (attachment format for Slack incoming webhooks), Discord (embed format for Discord webhooks), and PagerDuty (Events API v2 format with automatic severity mapping).',
      },
    ],
  },
  {
    id: 'license',
    title: 'License & Tiers',
    caption: 'Feature tiers and licensing',
    icon: 'mdi-license',
    items: [
      {
        question: 'What are the feature tiers?',
        answer:
          `Weaver has four tiers: Weaver Free (${PRICING.free.standard}, full free-tier features), Weaver Solo (${formatPricing('solo')} — single operator, live provisioning, firewall, distros, bridges, TLS), Weaver Team (${formatPricing('team')} — 2–4 users, everything Solo plus peer monitoring, workload groups, auditor role), and FabricK (${formatPricing('fabrick')} — full fleet governance, per-workload RBAC, quotas, audit log, fleet bridges).`,
      },
      {
        question: 'Where can I see my current tier?',
        answer:
          'Go to Settings and look for the License section. It shows your current tier badge, a description of your tier, and any expiry information.',
        link: '/settings',
        linkLabel: 'Go to Settings',
        linkIcon: 'mdi-cog',
      },
      {
        question: 'What features require Weaver Solo or higher?',
        answer:
          'Weaver Solo features include Live Provisioning (creating and deleting VMs without nixos-rebuild), server-provided AI key access, real serial console, disk backup and restore, push notification channels (ntfy, email, webhook, web push), network bridge management (IP pools, firewall rules), firewall + TLS, and distro management. Free-tier users see all read-only features (Weaver page, network topology, AI diagnostics with BYOK), can manage existing VMs (start, stop, restart), and can export VM configurations as JSON via the API. Tier-gated sections show an upgrade prompt with details about the locked feature.',
      },
      {
        question: 'What are bulk operations?',
        answer:
          'Bulk operations (start, stop, restart multiple workloads at once) are a FabricK-tier feature. Selection checkboxes and the bulk action bar appear only with a FabricK license.',
      },
      {
        question: 'What are resource quotas?',
        answer:
          'On FabricK tier, admins can set per-user limits on the maximum number of VMs, total memory (MB), and total vCPUs. When a quota is configured, the Create VM dialog shows current usage (e.g., "3 of 5 VMs used"). VM creation is blocked when any quota limit would be exceeded. Quotas default to unlimited (no restrictions) until explicitly set by an admin.',
      },
      {
        question: 'What is per-workload access control?',
        answer:
          'Per-workload ACL is a FabricK feature that lets admins restrict which workloads each user can access. By default, all users can see all workloads. On the Users page, click the shield icon next to a non-admin user to assign specific workloads. Users with ACL entries will only see and interact with their assigned workloads — on the Weaver page, detail pages, and real-time WebSocket updates. Admin users always bypass ACL restrictions. See the Admin Guide in the Docs tab for details.',
      },
      {
        question: 'Are tier restrictions enforced for the TUI and API?',
        answer:
          'Yes. Tier restrictions are enforced at the backend API level, not just in the web UI. Whether you use the web interface, the TUI, or direct API calls, tier-gated features return a 403 error if your license tier is insufficient. The web UI hides buttons and shows upgrade prompts as a convenience, but the backend is the authoritative gatekeeper.',
      },
      {
        question: 'What happens when a license expires?',
        answer:
          'After expiry, your tier features remain accessible in read-only mode for a 30-day grace period. A warning banner appears in Settings during this time. After 30 days, the instance downgrades to Free tier. See the Admin Guide in the Docs tab for license management details.',
      },
      {
        question: 'What is Live Provisioning?',
        answer:
          'Live Provisioning is the core Weaver Solo+ differentiator — creating and managing MicroVMs dynamically via the API and UI without running nixos-rebuild switch on the host. A one-time NixOS setup, then zero host rebuilds forever. See the Admin Guide in the Docs tab for the full comparison of NixOS-declared vs Live Provisioned MicroVMs.',
      },
      {
        question: 'What is the Firewall + TLS feature?',
        answer:
          'Weaver Solo includes managed firewall templates (nftables profiles for common workloads) and TLS certificate management. Firewall presets let you apply one-click egress rules per VM. TLS nudges Solo users to configure HTTPS. On FabricK tier, firewall extends to security zones with drift detection and an audit trail. Ships at v1.2.',
        minVersion: '1.2',
      },
    ],
  },
  {
    id: 'containers',
    title: 'Containers',
    caption: 'Docker, Podman, and Apptainer workloads',
    icon: 'mdi-docker',
    items: [
      {
        question: 'What container runtimes does Weaver support?',
        answer:
          'Weaver manages Docker, Podman, and Apptainer (SIF) containers alongside MicroVMs on a single interface. Docker and Podman visibility is available on all tiers starting at v1.1. Apptainer (for HPC/research workloads) requires Weaver Solo+. See the User Guide in the Docs tab for details.',
        minVersion: '1.1',
      },
      {
        question: 'How do containers appear on the Weaver page?',
        answer:
          'Containers are auto-detected from Docker, Podman, and Apptainer runtimes running on the host. They appear as cards on the Weaver page with runtime badges, port mappings, resource metrics, and labels. Use the filter chips (Docker / Podman / Apptainer) to focus on a specific runtime.',
        link: '/weaver',
        linkLabel: 'Go to Weaver',
        linkIcon: 'mdi-view-dashboard',
        minVersion: '1.1',
      },
      {
        question: 'Can I create containers from Weaver?',
        answer:
          'Yes. Starting at v2.1 (Weaver Solo+), you can create containers from the Shed page. Select the runtime (Docker, Podman, or Apptainer), enter the image name, port mappings, and environment variables. Container management (start, stop, create, remove) requires Weaver Solo+.',
        minVersion: '1.2',
      },
      {
        question: 'What is the difference between a container and a MicroVM?',
        answer:
          'A MicroVM is a container with a hardware boundary instead of a namespace boundary. Containers share the host kernel via namespaces (lighter, faster). MicroVMs run their own kernel in a hardware-isolated VM (stronger isolation, compliance-ready). Weaver manages both uniformly — same interface, same API, same bridge routing.',
        minVersion: '1.1',
      },
    ],
  },
  {
    id: 'topology',
    title: 'Strands',
    caption: 'Local and fleet network topology',
    icon: 'mdi-lan',
    items: [
      {
        question: 'What is the Strands page?',
        answer:
          'Strands shows the local network topology for a single host — bridges, workloads, and containers connected to each bridge, with cross-bridge routing edges. Interactive on all tiers (drag, zoom, search). On Weaver Team v2.2+, remote peer workloads appear with dashed edges. On FabricK v3.0+, bridge nodes show fleet bridge membership badges. See the User Guide in the Docs tab for full details.',
        link: '/network',
        linkLabel: 'Open Strands',
        linkIcon: 'mdi-lan',
      },
      {
        question: 'Why does the Bridges table show "auto-detected" badges?',
        answer:
          'Bridges are auto-detected from the network interfaces your workloads are attached to. These appear with an "auto-detected" badge and are read-only. With Weaver Solo+, you can create managed bridges with IP pools and firewall rules. See the Admin Guide in the Docs tab for bridge management details.',
      },
      {
        question: 'What is the Loom page?',
        answer:
          'Loom is the fleet topology view, available on FabricK tier at v3.0+. It shows all hosts in the fleet — on-prem, cloud, remote, and IoT — with WireGuard tunnel connections and cross-host workload service edges. Double-click a host to navigate to the FabricK overview for that host. See the User Guide in the Docs tab for full details.',
        link: '/loom',
        linkLabel: 'Open Loom',
        linkIcon: 'mdi-spider-web',
        minVersion: '3.0',
      },
      {
        question: 'What is the Loom logical view?',
        answer:
          'At v3.0+ FabricK, the Loom page has a "Tunnels / Fleet Bridges" toggle. The logical view shows fleet virtual bridges as hub nodes with host nodes radiating outward. Edges display traffic weights and cordon status. Click a fleet bridge to open its detail drawer with endpoint weights, blue/green deployment status, and configuration.',
        minVersion: '3.0',
      },
      {
        question: 'What is a fleet virtual bridge?',
        answer:
          'A fleet virtual bridge is a logical network bridge spanning multiple hosts, backed by overlay transport (VXLAN for datacenter, WireGuard for edge). It is the single primitive that replaces K8s CNI (network plugin), ingress controller + MetalLB (load balancing), and Argo Rollouts (blue/green deployment). AI agents operate fleet bridges — adjusting weights, triggering deployments, cordoning hosts. Each fleet bridge maps 1:1 to a workload group: creating a group creates its bridge, and the compliance boundary IS the network isolation boundary.',
        minVersion: '3.0',
      },
      {
        question: 'How does fleet bridge routing work?',
        answer:
          'Each fleet bridge has endpoints — workloads on specific hosts that auto-register via workload selectors. Traffic is distributed by weight (0–100%) across endpoints. The weight API (PUT /api/bridges/:name/weights) controls all routing. Blue/green deployment shifts weight between old and new endpoints. Cordon sets a host\'s weight to 0, draining traffic to other hosts. AI agents adjust weights based on latency, throughput, and health.',
        minVersion: '3.0',
      },
    ],
  },
  {
    id: 'fabrick',
    title: 'FabricK Fleet',
    caption: 'Multi-host fleet management',
    icon: 'mdi-domain',
    items: [
      {
        question: 'What is the FabricK overview page?',
        answer:
          'The FabricK page is the fleet control plane — an aggregate view of all enrolled hosts showing health status, workload counts, resource utilization, and host kind (on-prem, cloud, remote, IoT). Click a host card to drill into that host\'s workloads. Available at FabricK tier v3.0+.',
        link: '/fabrick',
        linkLabel: 'Open FabricK',
        linkIcon: 'mdi-domain',
        minVersion: '3.0',
      },
      {
        question: 'What is the Warp page?',
        answer:
          'Warp is the desired-state management surface for the FabricK fleet (v2.5+). A warp pattern defines what a host type should look like: which workloads, which bridges, which GPU assignment, which snapshot policy. Think of it as fleet configuration management — the declarative layer that tells each host what it should be running. Warp detects drift ("1 host drifted from pattern") and supports blue/green pattern deployment.',
        link: '/warp',
        linkLabel: 'Open Warp',
        linkIcon: 'mdi-texture',
        minVersion: '2.5',
      },
      {
        question: 'What are workload groups?',
        answer:
          'Workload groups (v3.3+ FabricK) are compliance boundaries that scope workloads, users, and AI policy. Each group can have compliance framework tags (HIPAA, PCI-DSS, CMMC), an AI policy (allow-all, claude-only, local-only, none), and IdP/LDAP group mapping. Creating a workload group automatically creates its fleet bridge — the network isolation boundary matches the compliance boundary. Access requests flow through an approval queue.',
        link: '/groups',
        linkLabel: 'Open Groups',
        linkIcon: 'mdi-folder-account',
        minVersion: '3.3',
      },
      {
        question: 'What is the Access Inspector?',
        answer:
          'The Access Inspector (v3.3+ FabricK) lets admins see Weaver as another user would. On Weaver Team, a simple "View as Viewer" toggle shows what a viewer-role user sees. On FabricK, the full inspector lets you pick any user and group combination to audit what workloads, actions, and data they can access. This is critical for compliance audits (HIPAA, CMMC) where you need to prove least-privilege access.',
        minVersion: '3.3',
      },
      {
        question: 'What is the difference between Weaver Solo and Weaver Team?',
        answer:
          `Weaver Solo (${formatPricing('solo')}) is for a single operator managing one host. Weaver Team (${formatPricing('team')} — 2–4 users) adds multi-user access, read-only remote peer monitoring of up to 2 other Weaver hosts, workload groups with AI policy, an auditor role, and the access inspector. Both share the same core features (Live Provisioning, firewall, distros, bridges). Team ships at v2.2.`,
        minVersion: '2.2',
      },
    ],
  },
  {
    id: 'shed',
    title: 'Shed',
    caption: 'Creating new workloads',
    icon: 'mdi-door-open',
    items: [
      {
        question: 'What is the Shed page?',
        answer:
          'Shed is the unified workload creation surface. It replaces the old "New Workload" button with a full page showing the template catalog (pre-configured workloads), custom MicroVM creation, container creation, and migration helpers. The template catalog is the hero element — browse templates by category and deploy with one click.',
        link: '/shed',
        linkLabel: 'Open Shed',
        linkIcon: 'mdi-door-open',
        minVersion: '2.0',
      },
      {
        question: 'What templates are available?',
        answer:
          'Templates are pre-configured workload definitions for common services: web servers (Nginx, Caddy), databases (PostgreSQL, MariaDB), monitoring (Prometheus, Grafana), security (Pi-hole, Vaultwarden), automation (Node-RED), and load balancing (HAProxy). Templates ship in two waves — Wave 1 at v2.0 (core services) and Wave 2 (extended catalog). Free-tier users can browse templates; deploying requires Weaver Solo.',
        minVersion: '2.0',
      },
      {
        question: 'Who can see the Shed page?',
        answer:
          'Shed is visible to Admin and Operator roles. Viewer and Auditor roles do not see Shed in the sidebar — they cannot create workloads. Free-tier users can browse the template catalog but cannot deploy (a tier upgrade prompt appears).',
        minVersion: '2.0',
      },
    ],
  },
  {
    id: 'extensions',
    title: 'Extensions',
    caption: 'Integrated security, DNS, and backup extensions',
    icon: 'mdi-puzzle',
    items: [
      {
        question: 'What is the Extensions page?',
        answer:
          'The Extensions page (also called Integrations) shows all available Weaver extensions organized by category: AI providers, DNS management, firewall, security hardening, authentication (TOTP, FIDO2, SSO), and backup. Each extension shows its minimum tier, status (active, coming soon), and target version. Extensions included with FabricK tier show a domain icon badge.',
        link: '/extensions',
        linkLabel: 'View Extensions',
        linkIcon: 'mdi-puzzle',
        minVersion: '1.1',
      },
      {
        question: 'How do extensions differ from core features?',
        answer:
          'Core features (VM management, Live Provisioning, bridges, fleet bridges) are built into Weaver. Extensions are modular add-ons that integrate with external systems or add specialized capabilities. Most extensions are included in the base tier price. AI Pro and AI Fleet are separate paid extensions (Decision #120) to prevent value leak on high-cost AI infrastructure.',
        minVersion: '1.1',
      },
    ],
  },
  {
    id: 'faq',
    title: 'FAQ',
    caption: 'Frequently asked questions',
    icon: 'mdi-frequently-asked-questions',
    items: [
      {
        question: 'What is the WebSocket indicator in the header?',
        answer:
          'The Live/Offline chip shows whether Weaver has an active WebSocket connection to the backend. When connected (green), workload statuses update in real-time every 2 seconds. When offline (red), statuses are stale until the connection is restored.',
      },
      {
        question: 'Why is my VM stuck in "Provisioning" state?',
        answer:
          'Provisioning can take several minutes, especially when downloading large cloud images. Check the Logs tab on the workload detail page for progress. If provisioning fails, the status changes to "Failed" with an error message.',
      },
      {
        question: 'Can I use this on mobile?',
        answer:
          'Yes. Weaver is a Progressive Web App (PWA) and works on mobile browsers. The responsive layout adapts to smaller screens. You can install it as a home screen app for a native-like experience.',
      },
      {
        question: 'Is dark mode supported?',
        answer:
          'Yes. Click the sun/moon icon in the top-right toolbar to toggle between light and dark mode. Your preference is remembered across sessions.',
      },
      {
        question: 'Can I run macOS as a guest?',
        answer:
          'Weaver does not currently support macOS guests. Apple\'s license agreement restricts macOS to Apple-branded hardware, and QEMU requires specialized configuration (bootloader, CPU flags, OSK key) that is not yet implemented.',
      },
      {
        question: 'What are the API rate limits?',
        answer:
          'The API enforces per-user rate limits. Auth endpoints (login, register, refresh) allow 10 requests per minute. VM mutations (start, stop, restart, create, delete) allow 30 requests per minute. AI agent requests have tier-based infrastructure protection limits (each request consumes API tokens, GPU compute, or host resources depending on your AI deployment): Free=5/min, Weaver Solo/Team=10/min, FabricK=30/min. All other endpoints allow 120 requests per minute. When a limit is exceeded, you will receive a 429 response — wait a moment and try again.',
      },
      {
        question: 'How do I keep my NixOS store clean?',
        answer:
          'Each nixos-rebuild creates a new generation, and the Nix store grows over time. Use the nh (nix-helper) tool to garbage-collect old generations while keeping recent ones as rollback targets.',
        steps: [
          'Install nh: add "nh" to your environment.systemPackages.',
          'Run: nh clean all --keep 3 — this removes all generations except the 3 most recent.',
          'Schedule it periodically (e.g. weekly systemd timer) to keep disk usage in check.',
        ],
      },
      {
        question: 'What if a cloud image URL is broken or returns a 404?',
        answer:
          'Weaver validates all distro image URLs daily using HEAD requests. Go to Settings > Distributions & Image URLs to see which URLs are valid (green check) or broken (red X). Admins can click the edit icon to update a broken URL. For built-in distros, this creates a custom override — you can reset to the default anytime. When provisioning fails due to a broken URL, the error banner includes a "Fix in Settings" shortcut.',
      },
      {
        question: 'How do I verify workloads from the command line?',
        answer:
          'You can use curl to check the API directly. First, log in to get a token, then use it for authenticated requests.',
        steps: [
          'Check service health (no auth): curl -s http://localhost:3100/api/health | jq .',
          'Log in: TOKEN=$(curl -s http://localhost:3100/api/auth/login -H "Content-Type: application/json" -d \'{"username":"YOUR_USER","password":"YOUR_PASS"}\' | jq -r \'.token\')',
          'List workloads: curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/workload | jq .',
          'Note: the login response uses "token" (not "accessToken"). Replace port 3100 with 3110 for dev or 3120 for E2E.',
        ],
      },
      {
        question: 'How do I test that distro images can provision and boot?',
        answer:
          'Weaver includes a distro catalog test agent that validates images end-to-end. You can test from the CLI (all modes) or from the Settings UI ("Test" button per distro). The CLI supports smoke tests (CirOS only), filtered tests, full catalog, and dry-run modes.',
        steps: [
          'Quick smoke test (CirOS ~20 MB): npm run test:distros',
          'Full catalog test: npm run test:distros:all',
          'Dry-run (check URLs + readiness): npm run test:distros:dry',
          'Pre-cache images: npm run test:distros:preload',
          'UI: Go to Settings > Distributions, click the play icon on any distro to run a "will it boot?" test.',
        ],
      },
      {
        question: 'How do I use the "Other" distro option?',
        answer:
          'Select "Other" in the distribution dropdown when creating a MicroVM to provision from any arbitrary disk image URL. This is useful for testing custom images, one-off workloads, or images not in the built-in catalog. Enter the direct download URL to a qcow2, raw, or ISO image, select the format, and optionally enable cloud-init for automatic network configuration. For reusable distros, add them as custom distros in Settings instead.',
        steps: [
          'On the Shed page, start creating a Custom MicroVM and select "Other" from the Distribution dropdown.',
          'Enter the direct URL to your disk image (http://, https://, or file://).',
          'Select the image format: QCOW2 (cloud images), Raw, or ISO (OS installers).',
          'For QCOW2 images, enable cloud-init if your image supports it (auto-configures networking).',
          'For ISO images, you will need to install the OS manually via the VNC console.',
        ],
      },
      {
        question: 'Where can I report bugs or request features?',
        answer:
          'File issues on the GitHub repository. Bug reports and feature requests are welcome.',
      },
    ],
  },
])

const filteredSections = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()

  return helpSections.value
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isVersionVisible(item.minVersion)),
    }))
    .filter((section) => section.items.length > 0)
    .map((section) => {
      if (!q) return section
      return {
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(q) ||
            item.answer.toLowerCase().includes(q) ||
            item.steps?.some((s) => s.toLowerCase().includes(q)),
        ),
      }
    })
    .filter((section) => section.items.length > 0)
})
</script>
