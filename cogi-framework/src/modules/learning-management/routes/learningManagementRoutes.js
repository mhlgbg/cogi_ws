import LearningObjectManagementPage from '../pages/LearningObjectManagementPage'
import GradeManagementPage from '../pages/GradeManagementPage'
import SubjectManagementPage from '../pages/SubjectManagementPage'
import QuestionManagementPage from '../pages/QuestionManagementPage'
import FormulaManagementPage from '../pages/FormulaManagementPage'
import LearningPackageImport from '../../learning/pages/LearningPackageImport.jsx'

const learningManagementRoutes = [
  {
    path: '/learning/learning-objects',
    featureKey: 'learning.learning-object.manage',
    component: LearningObjectManagementPage,
  },
  {
    path: '/learning/grades',
    featureKey: 'learning.grade.manage',
    component: GradeManagementPage,
  },
  {
    path: '/learning/subjects',
    featureKey: 'learning.subject.manage',
    component: SubjectManagementPage,
  },
  {
    path: '/learning/questions',
    featureKey: 'learning.question.manage',
    featureKeys: ['learning.question.manage', 'learning.learning-object.manage'],
    component: QuestionManagementPage,
  },
  {
    path: '/learning/formulas',
    featureKey: 'learning.formula.manage',
    featureKeys: ['learning.formula.manage', 'learning.learning-object.manage'],
    component: FormulaManagementPage,
  },
  {
    path: '/learning/import-packages',
    featureKey: 'learning.package-import.manage',
    component: LearningPackageImport,
  },
]

export default learningManagementRoutes
