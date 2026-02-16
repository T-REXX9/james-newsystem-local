import { describe, it, expect } from 'vitest';
import {
  applyOptimisticInsert,
  applyOptimisticUpdate,
  applyOptimisticDelete,
  rollbackOptimisticUpdate,
  applyOptimisticBulkUpdate,
  applyOptimisticBulkDelete,
} from '../optimisticUpdates';

interface TestItem {
  id: string;
  name: string;
  status: string;
}

describe('optimisticUpdates', () => {
  describe('applyOptimisticInsert', () => {
    it('should insert item at the end of list', () => {
      const list: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
        { id: '2', name: 'Item 2', status: 'active' },
      ];
      const newItem: TestItem = { id: '3', name: 'Item 3', status: 'active' };

      const result = applyOptimisticInsert(list, newItem);

      expect(result).toHaveLength(3);
      expect(result[2]).toEqual(newItem);
    });

    it('should insert and sort when sortFn provided', () => {
      const list: TestItem[] = [
        { id: '1', name: 'B Item', status: 'active' },
        { id: '2', name: 'C Item', status: 'active' },
      ];
      const newItem: TestItem = { id: '3', name: 'A Item', status: 'active' };
      const sortFn = (a: TestItem, b: TestItem) => a.name.localeCompare(b.name);

      const result = applyOptimisticInsert(list, newItem, sortFn);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('A Item');
      expect(result[1].name).toBe('B Item');
      expect(result[2].name).toBe('C Item');
    });
  });

  describe('applyOptimisticUpdate', () => {
    it('should update item by id', () => {
      const list: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
        { id: '2', name: 'Item 2', status: 'active' },
      ];

      const result = applyOptimisticUpdate(list, '2', { status: 'inactive' });

      expect(result[1].status).toBe('inactive');
      expect(result[1].name).toBe('Item 2');
    });

    it('should not modify other items', () => {
      const list: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
        { id: '2', name: 'Item 2', status: 'active' },
      ];

      const result = applyOptimisticUpdate(list, '2', { status: 'inactive' });

      expect(result[0]).toEqual(list[0]);
    });

    it('should return unchanged list if id not found', () => {
      const list: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
      ];

      const result = applyOptimisticUpdate(list, '999', { status: 'inactive' });

      expect(result).toEqual(list);
    });
  });

  describe('applyOptimisticDelete', () => {
    it('should remove item by id', () => {
      const list: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
        { id: '2', name: 'Item 2', status: 'active' },
        { id: '3', name: 'Item 3', status: 'active' },
      ];

      const result = applyOptimisticDelete(list, '2');

      expect(result).toHaveLength(2);
      expect(result.find(item => item.id === '2')).toBeUndefined();
    });

    it('should return unchanged list if id not found', () => {
      const list: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
      ];

      const result = applyOptimisticDelete(list, '999');

      expect(result).toEqual(list);
    });
  });

  describe('rollbackOptimisticUpdate', () => {
    it('should restore original list', () => {
      const originalList: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
      ];
      const currentList: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'inactive' },
      ];

      const result = rollbackOptimisticUpdate(currentList, originalList);

      expect(result).toEqual(originalList);
    });
  });

  describe('applyOptimisticBulkUpdate', () => {
    it('should update multiple items', () => {
      const list: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
        { id: '2', name: 'Item 2', status: 'active' },
        { id: '3', name: 'Item 3', status: 'active' },
      ];

      const updates = [
        { id: '1', updates: { status: 'inactive' } },
        { id: '3', updates: { status: 'inactive' } },
      ];

      const result = applyOptimisticBulkUpdate(list, updates);

      expect(result[0].status).toBe('inactive');
      expect(result[1].status).toBe('active');
      expect(result[2].status).toBe('inactive');
    });
  });

  describe('applyOptimisticBulkDelete', () => {
    it('should delete multiple items', () => {
      const list: TestItem[] = [
        { id: '1', name: 'Item 1', status: 'active' },
        { id: '2', name: 'Item 2', status: 'active' },
        { id: '3', name: 'Item 3', status: 'active' },
      ];

      const result = applyOptimisticBulkDelete(list, ['1', '3']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
  });
});

