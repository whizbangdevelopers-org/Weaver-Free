import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { VmCreateInput } from '../types/vm.js'

interface CreateVmFormProps {
  onSubmit: (input: VmCreateInput) => Promise<void>
  onBack: () => void
}

type Field = 'name' | 'ip' | 'mem' | 'vcpu' | 'hypervisor'

const FIELDS: Field[] = ['name', 'ip', 'mem', 'vcpu', 'hypervisor']

const HYPERVISORS = ['qemu', 'cloud-hypervisor', 'crosvm', 'kvmtool', 'firecracker'] as const

const NAME_RE = /^[a-z][a-z0-9-]*$/
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/

function validateName(v: string): string | null {
  if (v.length < 2) return 'Min 2 characters'
  if (!NAME_RE.test(v)) return 'Lowercase, digits, hyphens only (start with letter)'
  return null
}

function validateIp(v: string): string | null {
  if (!IPV4_RE.test(v)) return 'Must be a valid IPv4 address'
  const parts = v.split('.').map(Number)
  if (parts.some(p => p! > 255)) return 'Each octet must be 0-255'
  return null
}

function validateMem(v: string): string | null {
  const n = parseInt(v, 10)
  if (isNaN(n) || n < 64) return 'Min 64 MB'
  return null
}

function validateVcpu(v: string): string | null {
  const n = parseInt(v, 10)
  if (isNaN(n) || n < 1) return 'Min 1 vCPU'
  return null
}

export function CreateVmForm({ onSubmit, onBack }: CreateVmFormProps) {
  const [name, setName] = useState('')
  const [ip, setIp] = useState('')
  const [mem, setMem] = useState('256')
  const [vcpu, setVcpu] = useState('1')
  const [hvIndex, setHvIndex] = useState(0)
  const [field, setField] = useState<Field>('name')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const nameErr = validateName(name)
    if (nameErr) { setError(nameErr); setField('name'); return }
    const ipErr = validateIp(ip)
    if (ipErr) { setError(ipErr); setField('ip'); return }
    const memErr = validateMem(mem)
    if (memErr) { setError(memErr); setField('mem'); return }
    const vcpuErr = validateVcpu(vcpu)
    if (vcpuErr) { setError(vcpuErr); setField('vcpu'); return }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name,
        ip,
        mem: parseInt(mem, 10),
        vcpu: parseInt(vcpu, 10),
        hypervisor: HYPERVISORS[hvIndex]!,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create VM failed')
      setSubmitting(false)
    }
  }

  function nextField() {
    const idx = FIELDS.indexOf(field)
    if (idx < FIELDS.length - 1) setField(FIELDS[idx + 1]!)
  }

  function prevField() {
    const idx = FIELDS.indexOf(field)
    if (idx > 0) setField(FIELDS[idx - 1]!)
  }

  function currentValue(): string {
    switch (field) {
      case 'name': return name
      case 'ip': return ip
      case 'mem': return mem
      case 'vcpu': return vcpu
      case 'hypervisor': return HYPERVISORS[hvIndex]!
    }
  }

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'd')) {
      onBack()
      return
    }

    if (submitting) return

    if (key.return) {
      if (field === 'hypervisor') {
        void handleSubmit()
      } else if (currentValue()) {
        nextField()
      }
      return
    }

    if (key.tab) {
      if (key.shift) prevField()
      else {
        const idx = FIELDS.indexOf(field)
        setField(FIELDS[(idx + 1) % FIELDS.length]!)
      }
      return
    }

    // Hypervisor field: left/right to cycle
    if (field === 'hypervisor') {
      if (key.leftArrow || input === 'h') {
        setHvIndex(i => (i - 1 + HYPERVISORS.length) % HYPERVISORS.length)
      } else if (key.rightArrow || input === 'l') {
        setHvIndex(i => (i + 1) % HYPERVISORS.length)
      }
      return
    }

    if (key.backspace || key.delete) {
      switch (field) {
        case 'name': setName(v => v.slice(0, -1)); break
        case 'ip': setIp(v => v.slice(0, -1)); break
        case 'mem': setMem(v => v.slice(0, -1) || ''); break
        case 'vcpu': setVcpu(v => v.slice(0, -1) || ''); break
      }
      return
    }

    if (input && !key.ctrl && !key.meta) {
      switch (field) {
        case 'name': setName(v => v + input); break
        case 'ip': setIp(v => v + input); break
        case 'mem': if (/^\d$/.test(input)) setMem(v => v + input); break
        case 'vcpu': if (/^\d$/.test(input)) setVcpu(v => v + input); break
      }
    }
  })

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Create VM</Text>
      <Text dimColor>Tab to switch fields, Enter to advance/submit, Ctrl+D to cancel</Text>

      {error && <Text color="red">{error}</Text>}

      <Box marginTop={1}>
        <Text color={field === 'name' ? 'cyan' : undefined}>
          Name:       {name}{field === 'name' ? '█' : ''}
        </Text>
      </Box>
      <Box>
        <Text color={field === 'ip' ? 'cyan' : undefined}>
          IP:         {ip}{field === 'ip' ? '█' : ''}
        </Text>
      </Box>
      <Box>
        <Text color={field === 'mem' ? 'cyan' : undefined}>
          Memory (MB): {mem}{field === 'mem' ? '█' : ''}
        </Text>
      </Box>
      <Box>
        <Text color={field === 'vcpu' ? 'cyan' : undefined}>
          vCPUs:      {vcpu}{field === 'vcpu' ? '█' : ''}
        </Text>
      </Box>
      <Box>
        <Text color={field === 'hypervisor' ? 'cyan' : undefined}>
          Hypervisor: {'< '}{HYPERVISORS[hvIndex]}{' >'}{field === 'hypervisor' ? ' ◄►' : ''}
        </Text>
      </Box>

      {submitting && (
        <Box marginTop={1}>
          <Text color="yellow">Creating VM...</Text>
        </Box>
      )}
    </Box>
  )
}
