import { TestBed } from '@angular/core/testing';
import { DashboardDataService } from './dashboard-data.service';

describe('DashboardDataService', () => {
  let service: DashboardDataService;

  beforeEach(() => {
    service = TestBed.inject(DashboardDataService);
  });

  describe('tasks', () => {
    it('seeds 50 tasks with unique ids', () => {
      const ids = service.tasks().map((t) => t.id);
      expect(ids.length).toBe(50);
      expect(new Set(ids).size).toBe(50);
    });

    it('setTaskStatus updates only the matching task', () => {
      service.setTaskStatus(1, 'review');
      expect(service.tasks()[0].status).toBe('review');
      expect(service.tasks()[1].status).toBe('inProgress');
    });
  });

  describe('procurementBreakdown', () => {
    it('returns the five states with the base counts for "all" in the current month', () => {
      const result = service.procurementBreakdown('all', 0);
      expect(result.map((b) => b.state)).toEqual(['new', 'shipping', 'pending', 'cancelled', 'delivered']);
      expect(result.map((b) => b.count)).toEqual([50, 50, 50, 50, 123]);
    });

    it('scales counts down for a specific category', () => {
      const all = service.procurementBreakdown('all', 0)[0].count;
      const furniture = service.procurementBreakdown('furniture', 0)[0].count;
      expect(furniture).toBeLessThan(all);
    });

    it('gives lower counts for older months', () => {
      const now = service.procurementBreakdown('all', 0)[4].count;
      const older = service.procurementBreakdown('all', 3)[4].count;
      expect(older).toBeLessThan(now);
    });

    it('never returns a count below 1', () => {
      const counts = service.procurementBreakdown('vehicles', 20).map((b) => b.count);
      expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
    });

    it('keeps realistic counts for months years back', () => {
      expect(service.procurementBreakdown('all', 48)[4].count).toBe(123);
      expect(service.procurementBreakdown('all', 50)[4].count).toBeGreaterThan(50);
    });
  });

  describe('budgetItems', () => {
    it('returns 12 months in order', () => {
      expect(service.budgetItems(2025).map((m) => m.month)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it('uses the design values for 2025 and scales other years', () => {
      expect(service.budgetItems(2025)[0]).toEqual({ month: 0, spent: 42_000, remaining: 38_000 });
      expect(service.budgetItems(2026)[0].spent).toBe(Math.round(42_000 * 1.08));
      expect(service.budgetItems(2024)[0].spent).toBe(Math.round(42_000 * 0.9));
    });
  });

  describe('notifications', () => {
    it('counts unread notifications', () => {
      expect(service.unreadCount()).toBe(2);
    });

    it('markAllRead clears the unread count', () => {
      service.markAllRead();
      expect(service.unreadCount()).toBe(0);
      expect(service.notifications().length).toBe(3);
    });

    it('dismissNotification removes one and updates the count', () => {
      service.dismissNotification(1);
      expect(service.notifications().map((n) => n.id)).toEqual([2, 3]);
      expect(service.unreadCount()).toBe(1);
    });
  });
});
