import SurveyForm from '../pages/SurveyForm'
import SurveyList from '../pages/SurveyList'

const surveyRoutes = [
  {
    path: '/survey',
    featureKey: 'survey.list',
    component: SurveyList,
  },
  {
    path: '/survey/:assignmentId',
    featureKey: 'survey.list',
    component: SurveyForm,
  },
]

export default surveyRoutes