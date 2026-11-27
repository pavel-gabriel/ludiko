/**
 * Registers the grade 0–II math generators (counting … shapes). Imported by the content packs that use
 * them (src/engine/content/packs/), like every other self-registering generator module.
 */
import { addition, subtraction } from './arithmetic';
import { clock } from './clock';
import { compare } from './compare';
import { counting } from './counting';
import { fraction } from './fraction';
import { measure } from './measure';
import { money } from './money';
import { numberRecognition } from './numberRecognition';
import { placeValue } from './placeValue';
import { registerGenerator } from './registry';
import { shapes } from './shapes';
import { timeUnits } from './timeUnits';
import { wordProblem } from './wordProblem';

registerGenerator('counting', counting);
registerGenerator('number-recognition', numberRecognition);
registerGenerator('compare', compare);
registerGenerator('addition', addition);
registerGenerator('subtraction', subtraction);
registerGenerator('place-value', placeValue);
registerGenerator('word-problem', wordProblem);
registerGenerator('clock', clock);
registerGenerator('time-units', timeUnits);
registerGenerator('money', money);
registerGenerator('measure', measure);
registerGenerator('fraction', fraction);
registerGenerator('shapes', shapes);
