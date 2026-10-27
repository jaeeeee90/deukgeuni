import dogFace1 from '../assets/exercise-icons/dog-face-1.png'
import dogFace2 from '../assets/exercise-icons/dog-face-2.png'
import dogFace3 from '../assets/exercise-icons/dog-face-3.png'
import dogFace4 from '../assets/exercise-icons/dog-face-4.png'
import dogFace5 from '../assets/exercise-icons/dog-face-5.png'
import dogFace6 from '../assets/exercise-icons/dog-face-6.png'
import { getExerciseIconIndex } from '../features/workouts/exerciseIconData.js'

const exerciseIconSources = [dogFace1, dogFace2, dogFace3, dogFace4, dogFace5, dogFace6]

function ExerciseIcon({ exercise, fallback = '🏋️' }) {
  const iconIndex = getExerciseIconIndex(exercise)
  const source = iconIndex === null ? null : exerciseIconSources[iconIndex]

  return <span className="exercise-icon" aria-hidden="true">
    {source && <img alt="" src={source} onError={(event) => {
      event.currentTarget.hidden = true
      event.currentTarget.nextElementSibling.hidden = false
    }} />}
    <span className="exercise-icon__fallback" hidden={Boolean(source)}>{fallback}</span>
  </span>
}

export default ExerciseIcon
