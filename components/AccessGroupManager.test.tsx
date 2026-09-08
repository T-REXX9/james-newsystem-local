import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import AccessGroupManager from './AccessGroupManager';

afterEach(() => {
  cleanup();
});

describe('AccessGroupManager core group delete protection', () => {
  it('disables delete for Company Owner with a built-in system group reason', () => {
    render(
      <AccessGroupManager
        groups={[
          {
            id: '9',
            name: 'Company Owner',
            description: 'Reserved owner-level account',
            access_rights: ['*'],
            assigned_staff_count: 0,
            is_core: true,
          },
        ]}
        onCreateGroup={vi.fn()}
        onUpdateGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
      />
    );

    const deleteButton = screen.getByRole('button', {
      name: 'Company Owner is a built-in system group and cannot be deleted',
    });
    expect(deleteButton).toBeDisabled();
    expect(screen.getByText('Built-in')).toBeInTheDocument();
  });
});
