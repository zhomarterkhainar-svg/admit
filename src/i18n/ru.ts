// Source of truth for all UI strings. kk.ts / en.ts may be partial and fall back to ru.
export const ru = {
  'app.tagline': 'Путь Батыра — AI-тренер, которым управляешь телом',

  'setup.noPerson.msg': 'Тебя не видно',
  'setup.noPerson.fix': 'Встань перед камерой в 2–3 метрах, чтобы было видно тебя целиком',
  'setup.multiplePeople.msg': 'В кадре несколько человек',
  'setup.multiplePeople.fix': 'Останься в кадре один',
  'setup.tooClose.msg': 'Не видно ступней',
  'setup.tooClose.fix': 'Отойди на 1–2 шага назад, чтобы было видно тебя целиком',
  'setup.tooFar.msg': 'Ты слишком далеко',
  'setup.tooFar.fix': 'Подойди на шаг ближе к камере',
  'setup.offCenter.msg': 'Ты у края кадра',
  'setup.offCenter.fix': 'Встань в центр кадра',
  'setup.armsHidden.msg': 'Не видно рук',
  'setup.armsHidden.fix': 'Держи руки в кадре',
  'setup.notFacing.msg': 'Ты стоишь боком',
  'setup.notFacing.fix': 'Повернись лицом к камере',

  'squat.name': 'Приседание',
  'squat.howTo': 'Стопы на ширине плеч, садись назад как на стул, бедро до параллели с полом',
  'squat.depth.msg': 'Не засчитано: неглубокий присед',
  'squat.depth.fix': 'Присядь глубже — бедро до параллели с полом',
  'squat.valgus.msg': 'Колени заваливаются внутрь',
  'squat.valgus.fix': 'Разводи колени наружу, по линии носков',
  'squat.torso.msg': 'Корпус слишком наклонён вперёд',
  'squat.torso.fix': 'Держи грудь выше и садись назад, а не вниз',
  'squat.asym.msg': 'Ты садишься на одну ногу',
  'squat.asym.fix': 'Распредели вес равномерно на обе ноги',
  'squat.stance.msg': 'Стопы стоят слишком узко',
  'squat.stance.fix': 'Поставь стопы на ширину плеч',
  'squat.tempo.msg': 'Слишком быстро',
  'squat.tempo.fix': 'Опускайся медленнее — на 2 счёта',

  'praise.fixed': 'Отлично, так держать!',
} as const;

export type I18nKey = keyof typeof ru;
