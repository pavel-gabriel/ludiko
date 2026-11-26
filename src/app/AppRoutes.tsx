import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import HomePage from '@/components/lobby/HomePage';
import RouteFallback from '@/components/ui/RouteFallback';

/*
 * Code-splitting: every route except the home page is lazy-loaded so the
 * initial bundle stays small (budget: docs/PLAN.md §10, checked by
 * `npm run check:size`). To add a route use:
 *   const MyPage = lazy(() => import('@/components/.../MyPage'));
 * (default export; import the file directly, not a barrel index).
 */
const ItemsPreviewPage = lazy(() => import('@/ui/items/ItemsPreviewPage'));
const FramesPreviewPage = lazy(() => import('@/ui/frames/FramesPreviewPage'));
const PracticeListPage = lazy(() => import('@/ui/session/PracticeListPage'));
const PracticePage = lazy(() => import('@/ui/session/PracticePage'));
const LearnHomePage = lazy(() => import('@/ui/learn/LearnHomePage'));
const PlacementPage = lazy(() => import('@/ui/learn/PlacementPage'));
const MissionPage = lazy(() => import('@/ui/learn/MissionPage'));
const BitPage = lazy(() => import('@/ui/learn/BitPage'));
const SkillMapPage = lazy(() => import('@/ui/learn/SkillMapPage'));
const ExamPickerPage = lazy(() => import('@/ui/exam/ExamPickerPage'));
const ExamRunPage = lazy(() => import('@/ui/exam/ExamRunPage'));
const ParentPage = lazy(() => import('@/ui/learn/ParentPage'));
const AlbumPage = lazy(() => import('@/ui/album/AlbumPage'));
const MascotPreviewPage = lazy(() => import('@/ui/mascot/MascotPreviewPage'));
const FamilyAccountPage = lazy(() => import('@/ui/learn/FamilyAccountPage'));
const LearnPreviewPage = lazy(() => import('@/ui/learn/LearnPreviewPage'));
const ProfilePickerPage = lazy(() => import('@/components/profiles/ProfilePickerPage'));
const SinglePlayerPage = lazy(() => import('@/components/lobby/SinglePlayerPage'));
const MultiplayerPage = lazy(() => import('@/components/lobby/MultiplayerPage'));
const SettingsPage = lazy(() => import('@/components/lobby/SettingsPage'));
const CreditsPage = lazy(() => import('@/components/lobby/CreditsPage'));
// Legal pages (DRAFT pending lawyer review): text in src/legal/*
const PrivacyPage = lazy(() => import('@/components/legal/PrivacyPage'));
const TermsPage = lazy(() => import('@/components/legal/TermsPage'));
const CreateRoom = lazy(() => import('@/components/lobby/CreateRoom'));
const JoinRoom = lazy(() => import('@/components/lobby/JoinRoom'));
const LobbyPage = lazy(() => import('@/components/lobby/LobbyPage'));
const GameRouter = lazy(() => import('@/components/games/GameRouter'));
const InteractiveSetupPage = lazy(() => import('@/components/lobby/InteractiveSetupPage'));
const InteractiveGamePage = lazy(
  () => import('@/components/games/InteractiveGame/InteractiveGamePage'),
);
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard'));
const TeacherLogin = lazy(() => import('@/components/teacher/TeacherLogin'));
const TeacherDashboard = lazy(() => import('@/components/teacher/TeacherDashboard'));
const SessionConfig = lazy(() => import('@/components/teacher/SessionConfig'));
const SessionDetail = lazy(() => import('@/components/teacher/SessionDetail'));
const TeacherLiveDashboard = lazy(() => import('@/components/teacher/TeacherLiveDashboard'));
const SessionResults = lazy(() => import('@/components/teacher/SessionResults'));
const TemplatesPage = lazy(() => import('@/components/teacher/TemplatesPage'));
// Classroom (docs/CLASSROOM.md): classes, heatmap, assignments; the child's class assignment page
const ClassesPage = lazy(() => import('@/components/teacher/classes/ClassesPage'));
const ClassPage = lazy(() => import('@/components/teacher/classes/ClassPage'));
const ClassCodesPage = lazy(() => import('@/components/teacher/classes/ClassCodesPage'));
const ClassAssignmentPage = lazy(() => import('@/ui/learn/ClassAssignmentPage'));
const DevClassroomPage = lazy(() => import('@/classroom/dev/DevClassroomPage'));
const DevFamilyPage = lazy(() => import('@/family/dev/DevFamilyPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/** All application routes — add new pages here */
export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Player routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/profiles" element={<ProfilePickerPage />} />

          {/* Practice sessions (Phase 1A) */}
          <Route path="/practice" element={<PracticeListPage />} />
          <Route path="/practice/:skillId" element={<PracticePage />} />

          {/* Learner area (Phase 1A): check -> mission -> map, and the parent summary */}
          <Route path="/learn" element={<LearnHomePage />} />
          <Route path="/learn/check/:subject" element={<PlacementPage />} />
          <Route path="/learn/mission/:subject" element={<MissionPage />} />
          <Route path="/learn/bit/:subject/:index" element={<BitPage />} />
          <Route path="/learn/map/:subject" element={<SkillMapPage />} />
          <Route path="/learn/parent" element={<ParentPage />} />
          <Route path="/learn/exam" element={<ExamPickerPage />} />
          <Route path="/learn/exam/:exam/:test" element={<ExamRunPage />} />
          <Route path="/learn/album" element={<AlbumPage />} />
          <Route path="/learn/account" element={<FamilyAccountPage />} />
          <Route path="/learn/class/:assignmentId" element={<ClassAssignmentPage />} />

          {/* Dev previews (Phase 0) */}
          <Route path="/dev/learn" element={<LearnPreviewPage />} />
          <Route path="/dev/mascot" element={<MascotPreviewPage />} />
          <Route path="/dev/classroom" element={<DevClassroomPage />} />
          <Route path="/dev/family" element={<DevFamilyPage />} />
          <Route path="/dev/frames" element={<FramesPreviewPage />} />
          <Route path="/dev/items" element={<ItemsPreviewPage />} />
          <Route path="/singleplayer" element={<SinglePlayerPage />} />
          <Route path="/multiplayer" element={<MultiplayerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/create" element={<CreateRoom />} />
          <Route path="/join" element={<JoinRoom />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/interactive" element={<InteractiveSetupPage />} />
          <Route path="/game" element={<GameRouter />} />
          <Route path="/game/interactive" element={<InteractiveGamePage />} />

          {/* Admin route — PIN-protected, owner only */}
          <Route path="/admin" element={<AdminDashboard />} />

          {/* Teacher routes */}
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/session/new" element={<SessionConfig />} />
          <Route path="/teacher/session/:sessionId/edit" element={<SessionConfig />} />
          <Route path="/teacher/session/:sessionId" element={<SessionDetail />} />
          <Route path="/teacher/live/:sessionId" element={<TeacherLiveDashboard />} />
          <Route path="/teacher/results/:sessionId" element={<SessionResults />} />
          <Route path="/teacher/templates" element={<TemplatesPage />} />
          <Route path="/teacher/classes" element={<ClassesPage />} />
          <Route path="/teacher/classes/:classId" element={<ClassPage />} />
          <Route path="/teacher/classes/:classId/codes" element={<ClassCodesPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
