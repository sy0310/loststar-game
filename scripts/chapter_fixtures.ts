export {chapterQaFixture} from '../src/chapter/model';
import {attachChapter} from '../src/chapter/model';
import {makeReviewFixture} from '../prototypes/ref-ui/model';
export function chapterTreatmentFixture(now:number){return attachChapter(makeReviewFixture('restoration',now).state,true);}
