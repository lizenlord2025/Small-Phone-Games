const { EventBus } = require('./script.js');

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('should register and emit an event', () => {
    const callback = jest.fn();
    bus.on('test-event', callback);
    bus.emit('test-event', { data: 'hello' });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ data: 'hello' });
  });

  test('should support multiple listeners for the same event', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    bus.on('test-event', callback1);
    bus.on('test-event', callback2);
    bus.emit('test-event', 'payload');

    expect(callback1).toHaveBeenCalledWith('payload');
    expect(callback2).toHaveBeenCalledWith('payload');
  });

  test('should not crash when emitting an event with no listeners', () => {
    expect(() => {
      bus.emit('unregistered-event', 'data');
    }).not.toThrow();
  });

  test('should handle multiple distinct events', () => {
    const callbackA = jest.fn();
    const callbackB = jest.fn();
    bus.on('eventA', callbackA);
    bus.on('eventB', callbackB);

    bus.emit('eventA', 1);
    expect(callbackA).toHaveBeenCalledWith(1);
    expect(callbackB).not.toHaveBeenCalled();

    bus.emit('eventB', 2);
    expect(callbackB).toHaveBeenCalledWith(2);
  });

  test('should pass the payload to the callback correctly', () => {
    const callback = jest.fn();
    const complexPayload = { id: 123, status: 'success', tags: ['a', 'b'] };
    bus.on('complex', callback);
    bus.emit('complex', complexPayload);

    expect(callback).toHaveBeenCalledWith(complexPayload);
  });
});
