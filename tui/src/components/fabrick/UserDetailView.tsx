import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../../client/api.js'
import type { SafeUser, UserQuota, VmAcl } from '../../types/user.js'
import { ROLES } from '../../constants/vocabularies.js'

interface UserDetailViewProps {
  userId: string
  api: TuiApiClient
  onBack: () => void
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Box width={22}><Text dimColor>{label}:</Text></Box>
      <Text color={color}>{value}</Text>
    </Box>
  )
}

export function UserDetailView({ userId, api, onBack }: UserDetailViewProps) {
  const [user, setUser] = useState<SafeUser | null>(null)
  const [quotas, setQuotas] = useState<UserQuota | null>(null)
  const [acl, setAcl] = useState<VmAcl | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void Promise.all([
      api.listUsers().then(r => {
        if (r.status === 200) {
          const users = r.data as SafeUser[]
          setUser(users.find(u => u.id === userId) ?? null)
        }
      }),
      api.getUserQuotas(userId).then(r => {
        if (r.status === 200) setQuotas(r.data as UserQuota)
      }),
      api.getVmAcl(userId).then(r => {
        if (r.status === 200) setAcl(r.data as VmAcl)
      }),
    ]).finally(() => setLoading(false))
  }, [api, userId])

  useInput((input, key) => {
    if (key.escape || input === 'b') onBack()
  })

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="yellow">Loading user details...</Text>
      </Box>
    )
  }

  if (!user) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="red">User not found. Press b to go back.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>User Detail: {user.username}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold underline>Info</Text>
        <Row label="ID" value={user.id} />
        <Row label="Username" value={user.username} />
        <Row label="Role" value={user.role} color={user.role === ROLES.ADMIN ? 'red' : user.role === ROLES.OPERATOR ? 'yellow' : 'gray'} />
        <Row label="Created" value={user.createdAt} />
      </Box>

      {quotas && (
        <Box marginTop={1} flexDirection="column">
          <Text bold underline>Quotas</Text>
          <Row label="Max VMs" value={quotas.maxVms === null ? 'unlimited' : String(quotas.maxVms)} />
          <Row label="Max Memory" value={quotas.maxMemoryMB === null ? 'unlimited' : `${quotas.maxMemoryMB} MB`} />
          <Row label="Max vCPUs" value={quotas.maxVcpus === null ? 'unlimited' : String(quotas.maxVcpus)} />
          {quotas.currentVms !== undefined && <Row label="Current VMs" value={String(quotas.currentVms)} />}
          {quotas.currentMemoryMB !== undefined && <Row label="Current Memory" value={`${quotas.currentMemoryMB} MB`} />}
          {quotas.currentVcpus !== undefined && <Row label="Current vCPUs" value={String(quotas.currentVcpus)} />}
        </Box>
      )}

      {acl && (
        <Box marginTop={1} flexDirection="column">
          <Text bold underline>VM Access</Text>
          {acl.vmNames.length === 0 ? (
            <Text dimColor>All VMs (no restrictions)</Text>
          ) : (
            acl.vmNames.map(name => <Text key={name}>  {name}</Text>)
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>[b]ack</Text>
      </Box>
    </Box>
  )
}
