import * as React from 'react';
import renderer, { act, ReactTestRendererJSON } from 'react-test-renderer';

import { ThemedText } from '../ThemedText';

describe('ThemedText', () => {
  it('renders correctly', () => {
    let tree: ReactTestRendererJSON | ReactTestRendererJSON[] | null = null;

    act(() => {
      tree = renderer.create(<ThemedText>Snapshot test!</ThemedText>).toJSON();
    });

    expect(tree).toMatchSnapshot();
  });
});
