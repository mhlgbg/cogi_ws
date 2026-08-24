import { createElement } from 'react'
import LearningObjectManagementPage from '../pages/LearningObjectManagementPage'
import QuestionBankWorkspacePage, { LearningManagementTabRedirect } from '../pages/QuestionBankWorkspacePage'
import LearningPackageImport from '../../learning/pages/LearningPackageImport.jsx'

const learningManagementRoutes = [
  {
    path: '/learning/learning-objects',
    title: 'Đối tượng học tập',
    featureKey: 'learning.learning-object.manage',
    component: LearningObjectManagementPage,
  },
  {
    path: '/learning/grades',
    title: 'Khối lớp',
    featureKey: 'learning.grade.manage',
    component: () => createElement(LearningManagementTabRedirect, { targetTab: 'grades' }),
  },
  {
    path: '/learning/subjects',
    title: 'Môn học',
    featureKey: 'learning.subject.manage',
    component: () => createElement(LearningManagementTabRedirect, { targetTab: 'subjects' }),
  },
  {
    path: '/learning/questions',
    title: 'Ngân hàng câu hỏi',
    featureKey: 'learning.question.manage',
    featureKeys: ['learning.question.manage', 'learning.learning-object.manage'],
    component: QuestionBankWorkspacePage,
  },
  {
    path: '/learning/formulas',
    title: 'Công thức',
    featureKey: 'learning.formula.manage',
    featureKeys: ['learning.formula.manage', 'learning.learning-object.manage'],
    component: () => createElement(LearningManagementTabRedirect, { targetTab: 'formulas' }),
  },
  {
    path: '/learning/import-packages',
    title: 'Import gói học liệu',
    featureKey: 'learning.package-import.manage',
    component: LearningPackageImport,
  },
]

export default learningManagementRoutes
