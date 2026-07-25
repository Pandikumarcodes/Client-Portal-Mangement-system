import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardSummaryCard } from './dashboard-summary-card.jsx';

describe('DashboardSummaryCard', () => {
  it.each([
    ['Total', 0, '0'],
    ['Active', 42, '42'],
    ['Large count', 123456789, (123456789).toLocaleString()],
  ])('renders %s and its safe count', (label, count, expected) => {
    const { container } = render(
      <dl><DashboardSummaryCard label={label} count={count} /></dl>,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(container.querySelector('dt')).toHaveTextContent(label);
    expect(container.querySelector('dd')).toHaveTextContent(expected);
  });

  it.each([undefined, null, Number.NaN, -1, 1.5])(
    'does not render an unsafe count (%s)',
    (count) => {
      const { container } = render(
        <dl><DashboardSummaryCard label="Count" count={count} /></dl>,
      );
      expect(container).not.toHaveTextContent('undefined');
      expect(container).not.toHaveTextContent('NaN');
      expect(screen.getByText('0')).toBeInTheDocument();
    },
  );

  it('contains no chart, percentage, or trend semantics', () => {
    const { container } = render(
      <dl><DashboardSummaryCard label="Total" count={4} /></dl>,
    );
    expect(container.querySelector('svg, canvas')).toBeNull();
    expect(container).not.toHaveTextContent('%');
    expect(container).not.toHaveTextContent(/trend/i);
  });
});
