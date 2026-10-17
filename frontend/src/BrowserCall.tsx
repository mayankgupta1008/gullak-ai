import { useEffect, useRef, useState } from 'react'
import {
  AgentState,
  BrowserAudioInterface,
  ConversationAgent,
  InteractionType,
  type InteractionConfig,
  type ServerTranscriptMsg,
} from 'sarvam-conv-ai-sdk/browser'

type Props = { onStarted: () => void }
type SessionConfig = {
  orgId: string
  workspaceId: string
  appId: string
  version?: number
  userIdentifier: string
  agentVariables: Record<string, string>
}
type SessionError = { error: string }

const stateText: Record<AgentState, string> = {
  [AgentState.IDLE]: '',
  [AgentState.CONNECTING]: 'Connecting...',
  [AgentState.CONNECTED]: 'Connected. Say hello.',
  [AgentState.LISTENING]: 'Listening... go ahead and talk.',
  [AgentState.SPEAKING]: 'ezpolicy is speaking...',
  [AgentState.ERROR]: 'The voice session hit an error.',
}

// Live voice call inside our page. The phone opens the HTTPS app; Sarvam handles voice over WebSocket.
export function BrowserCall({ onStarted }: Props) {
  const agentRef = useRef<ConversationAgent | null>(null)
  const [state, setState] = useState<AgentState>(AgentState.IDLE)
  const [callActive, setCallActive] = useState(false)
  const [error, setError] = useState('')
  const [lastTranscript, setLastTranscript] = useState('')
  const live = callActive || Boolean(agentRef.current)

  useEffect(() => {
    return () => {
      void agentRef.current?.stop().catch(() => undefined)
      agentRef.current = null
      setCallActive(false)
    }
  }, [])

  async function stop() {
    await agentRef.current?.stop()
    agentRef.current = null
    setCallActive(false)
    setState(AgentState.IDLE)
  }

  async function start() {
    if (live) return
    setError('')
    setLastTranscript('')
    setState(AgentState.CONNECTING)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())

      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const session = await response.json().catch(() => null) as SessionConfig | SessionError | null
      if (!response.ok || !session) {
        throw new Error('Sarvam session is not configured')
      }
      if (isSessionError(session)) {
        throw new Error(session.error)
      }

      const config: InteractionConfig = {
        org_id: session.orgId,
        workspace_id: session.workspaceId,
        app_id: session.appId,
        version: session.version,
        user_identifier: session.userIdentifier,
        user_identifier_type: 'custom',
        interaction_type: InteractionType.CALL,
        input_sample_rate: 16000,
        output_sample_rate: 16000,
        agent_variables: session.agentVariables,
      }

      const agent = new ConversationAgent({
        apiKey: '',
        baseUrl: '/api/sarvam/',
        platform: 'browser',
        config,
        audioInterface: new BrowserAudioInterface(16000),
        stateCallback: newState => setState(newState),
        transcriptCallback: async (msg: ServerTranscriptMsg) => {
          setLastTranscript(`${msg.role}: ${msg.content}`)
        },
        startCallback: async () => {
          setCallActive(true)
        },
        endCallback: async () => {
          agentRef.current = null
          setCallActive(false)
          setState(AgentState.IDLE)
        },
      })

      agentRef.current = agent
      setCallActive(true)
      await agent.start()
      const connected = await agent.waitForConnect(10)
      if (!connected) throw new Error('Sarvam voice session timed out')
      onStarted()
    } catch (err) {
      await agentRef.current?.stop().catch(() => undefined)
      agentRef.current = null
      setCallActive(false)
      setState(AgentState.ERROR)
      setError(err instanceof Error ? err.message : 'Could not start the call. Allow microphone access and try again.')
    }
  }

  return (
    <div className="call-feedback" aria-live="polite">
      <button type="button" className="button" onClick={live ? () => void stop() : () => void start()}>
        {live ? 'End call' : 'Start voice check-in'}
      </button>
      <p>{error || lastTranscript || stateText[state]}</p>
    </div>
  )
}

function isSessionError(session: SessionConfig | SessionError): session is SessionError {
  return 'error' in session
}
