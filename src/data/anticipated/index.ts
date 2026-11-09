// all anticipated exam questions, model/finance first, then simulation/queues, then data tools
import type { AnticipatedQ } from './types'
import { questions as model } from './model'
import { questions as simulation } from './simulation'
import { questions as data } from './data'

export type { AnticipatedQ } from './types'
export const anticipated: readonly AnticipatedQ[] = [...model, ...simulation, ...data]
