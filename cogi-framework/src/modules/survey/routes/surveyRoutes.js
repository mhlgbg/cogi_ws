import SurveyForm from '../pages/SurveyForm'
import SurveyList from '../pages/SurveyList'

const surveyRoutes = [
  {
    path: '/survey',
    title: 'Khảo sát',
    featureKey: 'survey.list',
    component: SurveyList,
  },
  {
    path: '/survey/:assignmentId',
    title: 'Thực hiện khảo sát',
    featureKey: 'survey.list',
    component: SurveyForm,
  },
]

export default surveyRoutes