import React from 'react';
import { mount } from 'enzyme';
import ModalWrapper from '../ModalWrapper';

describe('ModalWrapper', () => {
  let mockProps = {};

  beforeEach(() => {
    mockProps = {
      id: 'modal',
      buttonTriggerText: 'Test Modal',
      modalHeading: 'Transactional Modal',
      primaryButtonText: 'Save',
      secondaryButtonText: 'Cancel',
      handleSubmit: jest.fn(() => true),
      shouldCloseAfterSubmit: true,
    };
  });

  it('should render', () => {
    const wrapper = mount(
      <ModalWrapper {...mockProps}>
        <p className="bx--modal-content__text">Text</p>
      </ModalWrapper>
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('should close after a successful submit action', () => {
    const wrapper = mount(
      <ModalWrapper {...mockProps}>
        <p className="bx--modal-content__text">Text</p>
      </ModalWrapper>
    );
    wrapper.find({ children: mockProps.buttonTriggerText }).simulate('click');
    expect(wrapper.state('open')).toBe(true);

    wrapper.find({ children: mockProps.primaryButtonText }).simulate('click');
    expect(wrapper.state('open')).toBe(false);
  });

  it('should not close after an unsuccessful submit action', () => {
    mockProps.handleSubmit = jest.fn(() => false);
    const wrapper = mount(
      <ModalWrapper {...mockProps}>
        <p className="bx--modal-content__text">Text</p>
      </ModalWrapper>
    );
    wrapper.find({ children: mockProps.buttonTriggerText }).simulate('click');
    expect(wrapper.state('open')).toBe(true);

    wrapper.find({ children: mockProps.primaryButtonText }).simulate('click');
    expect(wrapper.state('open')).toBe(true);
  });

  it('should change state on escape action', () => {
    const wrapper = mount(
      <ModalWrapper {...mockProps}>
        <p className="bx--modal-content__text">Text</p>
      </ModalWrapper>
    );

    wrapper.setState({ open: true });
    expect(wrapper.state('open')).toBe(true);

    wrapper
      .find({ children: mockProps.buttonTriggerText })
      .simulate('keyDown', { key: 'Esc', keyCode: 27, which: 27 });
    expect(wrapper.state('open')).toBe(false);
  });
});
