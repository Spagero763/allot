import { useEffect, useState } from 'react'
import type { PublicKey } from '@solana/web3.js'
import { configPda } from 'allot-sdk'
import { useProgram } from './hooks'

export interface Config {
  admin: PublicKey
  feeDestination: PublicKey
  feeBps: number
  paused: boolean
}

export function useConfig(): Config | null {
  const program = useProgram()
  const [config, setConfig] = useState<Config | null>(null)
  useEffect(() => {
    program.account.config
      .fetchNullable(configPda())
      .then((c) => c && setConfig({ admin: c.admin, feeDestination: c.feeDestination, feeBps: c.feeBps, paused: c.paused }))
      .catch(() => setConfig(null))
  }, [program])
  return config
}
