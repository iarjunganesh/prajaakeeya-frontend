// PAGE TEST for NotificationsPage — the user's notification inbox.
//
// What this page does (the parts we test):
//   - On mount calls listNotifications({page,limit}) and reads `data.data` (an
//     array of ApiNotification), mapping each into a UI row grouped by
//     today/yesterday/earlier.
//   - Header title, an All/Unread filter toggle, and "Mark all read" / "Clear
//     all" buttons (disabled when there is nothing to act on).
//   - Clicking a row marks it read (markNotificationRead) and, if it has an href,
//     navigates there. Each row has a Delete icon (deleteNotification).
//
// Setup notes:
//   - i18n mocked: many strings are `t('...') || 'Fallback'`. Since the KEY is
//     truthy, the KEY wins — so we assert on KEY strings (e.g.
//     'notifications.title') and on the notification title/body data we feed in.
//   - useNavigate is spied; the rest of react-router-dom stays real.
//   - notificationService is fully mocked. listNotifications returns one UNREAD
//     "new_aspirant" notification created "now" (bucket = today) with an
//     aspirantId so it gets an href (/user/aspirants/:id/view) — that lets us
//     assert the click -> markRead + navigate path.

import { renderWithProviders, screen, fireEvent, within, waitFor } from './test-utils';
import NotificationsPage from '../pages/NotificationsPage';
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../services/notificationService';

// --- i18n: stable refs; t() echoes the key (or defaultValue). ---
const t = (k: string, o?: any) => (o && o.defaultValue ? o.defaultValue : k);
const i18n = { language: 'en', changeLanguage: () => Promise.resolve(), t };
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n }),
  Trans: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// --- Router: spy useNavigate, keep the rest real. ---
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...((await orig()) as any),
  useNavigate: () => navigate,
}));

// --- notificationService: fully mocked. listNotifications returns one UNREAD
// notification dated "now" (today bucket) so the Mark-all-read button is enabled.
// Spies are declared INSIDE the factory (no top-level refs, since vi.mock is
// hoisted) and read back later via vi.mocked() on the imported functions. ---
vi.mock('../services/notificationService', () => ({
  listNotifications: vi.fn(() =>
    Promise.resolve({
      data: {
        data: [
          {
            id: 101,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            userId: 5,
            type: 'new_aspirant',
            title: 'New aspirant in your ward',
            body: 'Asha Rao just registered.',
            aspirantId: 7,
            aspirantName: 'Asha Rao',
            electionId: null,
            constituencyId: null,
            constituencyName: null,
            meetingId: null,
            visitId: null,
            metadata: null,
            isRead: false,
            readAt: null,
          },
        ],
        total: 1,
        unreadCount: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    }),
  ),
  markNotificationRead: vi.fn(() => Promise.resolve({ data: {} })),
  markAllNotificationsRead: vi.fn(() => Promise.resolve({ data: {} })),
  deleteNotification: vi.fn(() => Promise.resolve({ data: {} })),
  clearAllNotifications: vi.fn(() => Promise.resolve({ data: {} })),
  emitNotificationsChanged: vi.fn(),
}));

describe('NotificationsPage', () => {
  it('renders the page title (i18n key)', async () => {
    renderWithProviders(<NotificationsPage />);
    expect(await screen.findByText('notifications.title')).toBeInTheDocument();
  });

  it('renders a fetched notification (title + body) once loaded', async () => {
    renderWithProviders(<NotificationsPage />);
    expect(await screen.findByText('New aspirant in your ward')).toBeInTheDocument();
    expect(screen.getByText('Asha Rao just registered.')).toBeInTheDocument();
  });

  it('marks all as read when "Mark all read" is clicked', async () => {
    renderWithProviders(<NotificationsPage />);
    // Wait for the loaded row so the unread count > 0 enables the button.
    await screen.findByText('New aspirant in your ward');
    fireEvent.click(screen.getByRole('button', { name: 'notifications.markAllRead' }));
    await waitFor(() => expect(vi.mocked(markAllNotificationsRead)).toHaveBeenCalled());
  });

  it('marks read and navigates to the aspirant view when a row is clicked', async () => {
    renderWithProviders(<NotificationsPage />);
    const title = await screen.findByText('New aspirant in your ward');
    fireEvent.click(title);
    await waitFor(() => expect(vi.mocked(markNotificationRead)).toHaveBeenCalledWith(101));
    // new_aspirant with aspirantId -> /user/aspirants/:id/view
    expect(navigate).toHaveBeenCalledWith('/user/aspirants/7/view');
  });

  it('deletes a notification via its delete icon', async () => {
    renderWithProviders(<NotificationsPage />);
    const title = await screen.findByText('New aspirant in your ward');
    // The delete IconButton lives inside the row; scope the query to that row's card.
    const row = title.closest('div')!.parentElement as HTMLElement;
    // The button now carries an explicit aria-label ("Delete notification"),
    // which takes precedence over the Tooltip title for its accessible name.
    const delBtn = within(row).getByRole('button', { name: 'Delete notification' });
    fireEvent.click(delBtn);
    await waitFor(() => expect(vi.mocked(deleteNotification)).toHaveBeenCalledWith(101));
  });
});
