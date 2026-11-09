import type { Exercise } from '../../lab/types'
import { exercises as w01 } from './w01'
import { exercises as w02 } from './w02'
import { exercises as w03 } from './w03'
import { exercises as w04 } from './w04'
import { exercises as w05 } from './w05'
import { exercises as w06 } from './w06'
import { exercises as w10 } from './w10'

export { mocks } from './mocks'
export { EXAM_TECHNIQUES } from './techniques'

// w09 (macros and VBA) is left out: VBA is not tested in the final. Its exercises stay in w09.ts for the VBA engine tests.
export const exercises: readonly Exercise[] = [...w01, ...w02, ...w03, ...w04, ...w05, ...w06, ...w10]
export const exerciseById = (id: string): Exercise | undefined => exercises.find(e => e.id === id)
