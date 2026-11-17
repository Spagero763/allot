import type { ReactNode } from 'react'
import { Page, Reveal } from '@/ui/motion'

const CONTACT = 'https://github.com/Spagero763/allot/issues'

function Doc({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <Page className="mx-auto max-w-3xl px-4 pt-10 md:px-6 md:pt-16">
      <Reveal>
        <p className="mono text-xs uppercase tracking-[0.2em] text-mute">{label}</p>
        <h1 className="display mt-2 text-5xl md:text-6xl">{title}</h1>
      </Reveal>
      <div className="mt-8 space-y-8 text-paper-2">{children}</div>
    </Page>
  )
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="display text-2xl text-paper">{title}</h2>
      <div className="mt-2 space-y-3 leading-relaxed">{children}</div>
    </section>
  )
}

export function Privacy() {
  return (
    <Doc label="Privacy" title="What we see, and what we do not">
      <Part title="No accounts, no tracking">
        <p>Allot has no sign-up, no analytics, no advertising and no cookies. We do not ask for your name, email, phone number or location.</p>
      </Part>
      <Part title="Your wallet">
        <p>
          When you connect a wallet, the app reads your public address so it can show your balances and positions. Your private keys never leave your wallet, and every transaction is approved by you inside
          it.
        </p>
        <p>Subscriptions, allotments, refunds and receipts are recorded on the Solana blockchain. That record is public and permanent by design, and it is not something we can edit or delete.</p>
      </Part>
      <Part title="The faucet and the demo verifier">
        <p>
          If you ask for test tokens or a demo attestation, your public address is sent to our server so the transaction can be issued to it. The address is used for that request and for a short cooldown,
          and is not stored afterwards.
        </p>
      </Part>
      <Part title="Other services">
        <p>The app talks to a Solana RPC provider to read and send transactions, and the site is served by a hosting provider. Both can see ordinary request data such as your IP address.</p>
      </Part>
      <Part title="Questions">
        <p>
          Open an issue at{' '}
          <a className="underline" href={CONTACT} target="_blank" rel="noreferrer">
            github.com/Spagero763/allot
          </a>
          .
        </p>
      </Part>
    </Doc>
  )
}

export function Terms() {
  return (
    <Doc label="Terms" title="Terms of use">
      <Part title="A demonstration on a test network">
        <p>
          This deployment runs on Solana devnet. The tokens it uses have no monetary value, and the issuers and offers shown are fictional examples. Nothing here is an offer of securities or an invitation
          to invest, and nothing here is financial, legal or tax advice.
        </p>
      </Part>
      <Part title="How the software behaves">
        <p>
          Allot is an open source program. Terms of an offer are fixed when it is created, allotment follows the published formula, and settlement can be run by anyone once an offer closes. We do not hold
          your funds and cannot reverse a transaction you have signed.
        </p>
      </Part>
      <Part title="Your responsibility">
        <p>You are responsible for your wallet, your keys and the transactions you approve. Use the app only where doing so is lawful for you.</p>
      </Part>
      <Part title="No warranty">
        <p>The software is provided as is, under the MIT licence, without warranty of any kind. To the extent the law allows, the authors are not liable for losses arising from its use.</p>
      </Part>
      <Part title="Changes and contact">
        <p>
          These terms may be updated as the product develops. Questions go to{' '}
          <a className="underline" href={CONTACT} target="_blank" rel="noreferrer">
            github.com/Spagero763/allot
          </a>
          .
        </p>
      </Part>
    </Doc>
  )
}
