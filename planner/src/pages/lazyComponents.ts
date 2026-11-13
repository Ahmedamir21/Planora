// Screens and dialogs that load only when they are needed (keeps the first load small).
import { lazy } from 'react';

export const ReportIssueDialog = lazy(() => import('../components/ReportIssueDialog').then((m) => ({ default: m.ReportIssueDialog })));

export const FeedbackDialog = lazy(() => import('../components/FeedbackDialog').then((m) => ({ default: m.FeedbackDialog })));

export const CrossYearBrowser = lazy(() => import('../components/CrossYearBrowser').then((m) => ({ default: m.CrossYearBrowser })));

export const CreditsDashboard = lazy(() => import('../components/CreditsDashboard').then((m) => ({ default: m.CreditsDashboard })));

export const AboutPage = lazy(() => import('../components/AboutPage').then((m) => ({ default: m.AboutPage })));

export const BestSchedule = lazy(() => import('../components/BestSchedule').then((m) => ({ default: m.BestSchedule })));

export const CommandPalette = lazy(() => import('../components/CommandPalette').then((m) => ({ default: m.CommandPalette })));

export const ScheduleAssistant = lazy(() => import('../components/ScheduleAssistant').then((m) => ({ default: m.ScheduleAssistant })));

export const ShareScheduleImage = lazy(() => import('../components/ShareScheduleImage').then((m) => ({ default: m.ShareScheduleImage })));
