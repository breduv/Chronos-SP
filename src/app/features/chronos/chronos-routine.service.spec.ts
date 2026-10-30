import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { ChronosRoutineService } from './chronos-routine.service';
import { TaskService } from '../tasks/task.service';
import { DEFAULT_TASK, TaskReminderOptionId } from '../tasks/task.model';
import { TaskRepeatCfgService } from '../task-repeat-cfg/task-repeat-cfg.service';
import { DateService } from '../../core/date/date.service';
import {
  selectActiveTaskRepeatCfgs,
  selectAllTaskRepeatCfgs,
} from '../task-repeat-cfg/store/task-repeat-cfg.selectors';
import {
  DEFAULT_TASK_REPEAT_CFG,
  TaskRepeatCfg,
} from '../task-repeat-cfg/task-repeat-cfg.model';
import { selectAllTasks } from '../tasks/store/task.selectors';

describe('ChronosRoutineService', () => {
  let service: ChronosRoutineService;
  let tasks: jasmine.SpyObj<TaskService>;
  let repeat: jasmine.SpyObj<TaskRepeatCfgService>;
  beforeEach(() => {
    tasks = jasmine.createSpyObj<TaskService>('tasks', [
      'add',
      'addAndSchedule',
      'scheduleTask',
      'update',
    ]);
    tasks.add.and.returnValue('habit-task');
    tasks.addAndSchedule.and.resolveTo('event');
    repeat = jasmine.createSpyObj<TaskRepeatCfgService>('repeat', [
      'addTaskRepeatCfgToTask',
      'updateTaskRepeatCfg',
    ]);
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [
            { selector: selectAllTaskRepeatCfgs, value: [] },
            { selector: selectActiveTaskRepeatCfgs, value: [] },
            { selector: selectAllTasks, value: [] },
          ],
        }),
        DateService,
        { provide: TaskService, useValue: tasks },
        { provide: TaskRepeatCfgService, useValue: repeat },
      ],
    });
    service = TestBed.inject(ChronosRoutineService);
  });
  it('uses the existing scheduled-task path with an exact duration and opt-in reminder', async () => {
    await service.addEvent({
      title: '  Class  ',
      start: '2026-10-29T09:00',
      end: '2026-10-29T10:30',
      reminder: TaskReminderOptionId.m15,
    });
    expect(tasks.addAndSchedule).toHaveBeenCalledWith(
      'Class',
      { projectId: 'INBOX_PROJECT', timeEstimate: 5400000, hasPlannedTime: true },
      new Date('2026-10-29T09:00').getTime(),
      TaskReminderOptionId.m15,
      true,
    );
  });
  it('rejects zero/reversed durations without creating tasks', async () => {
    expect(
      await service.addEvent({
        title: 'Class',
        start: '2026-10-29T09:00',
        end: '2026-10-29T08:00',
        reminder: TaskReminderOptionId.DoNotRemind,
      }),
    ).toBeNull();
    expect(tasks.addAndSchedule).not.toHaveBeenCalled();
  });
  it('supports an event ending on the following day', async () => {
    expect(
      await service.addEvent({
        title: 'Train',
        start: '2026-10-29T23:00',
        end: '2026-10-30T01:00',
        reminder: TaskReminderOptionId.AtStart,
      }),
    ).toBe('event');
    expect(tasks.addAndSchedule.calls.mostRecent().args[1]?.timeEstimate).toBe(7200000);
  });
  it('creates habits as existing weekly repeat configurations with time and reminders', () => {
    expect(
      service.addHabit({
        title: 'Read',
        time: '20:30',
        weekdays: [1, 3, 5],
        reminder: TaskReminderOptionId.AtStart,
      }),
    ).toBe('habit-task');
    expect(repeat.addTaskRepeatCfgToTask).toHaveBeenCalledWith(
      'habit-task',
      'INBOX_PROJECT',
      jasmine.objectContaining({
        isChronosHabit: true,
        startTime: '20:30',
        remindAt: TaskReminderOptionId.AtStart,
        monday: true,
        tuesday: false,
        wednesday: true,
        thursday: false,
        friday: true,
        saturday: false,
        sunday: false,
        skipOverdue: true,
      }),
    );
  });
  it('requires at least one weekday and a valid time', () => {
    expect(
      service.addHabit({
        title: 'Read',
        time: '20:30',
        weekdays: [],
        reminder: TaskReminderOptionId.DoNotRemind,
      }),
    ).toBeNull();
    expect(
      service.addHabit({
        title: 'Read',
        time: '25:90',
        weekdays: [1],
        reminder: TaskReminderOptionId.DoNotRemind,
      }),
    ).toBeNull();
    expect(tasks.add).not.toHaveBeenCalled();
  });
  it('creates a reminder task without an estimated duration', async () => {
    await service.addTask({
      title: 'Call',
      start: '2026-10-30T12:00',
      reminder: TaskReminderOptionId.AtStart,
    });
    expect(tasks.addAndSchedule).toHaveBeenCalledWith(
      'Call',
      { projectId: 'INBOX_PROJECT' },
      new Date('2026-10-30T12:00').getTime(),
      TaskReminderOptionId.AtStart,
      true,
    );
  });
  it('edits the end of an existing event and reschedules its reminder', () => {
    const task = {
      ...DEFAULT_TASK,
      id: 'class',
      title: 'Class',
      projectId: 'INBOX_PROJECT',
    };
    expect(
      service.updateEvent(task, {
        title: 'Class',
        start: '2026-10-30T09:00',
        end: '2026-10-30T11:00',
        reminder: TaskReminderOptionId.m15,
      }),
    ).toBeTrue();
    expect(tasks.update).toHaveBeenCalledWith('class', {
      title: 'Class',
      timeEstimate: 7200000,
      hasPlannedTime: true,
    });
    expect(tasks.scheduleTask).toHaveBeenCalledWith(
      task,
      new Date('2026-10-30T09:00').getTime(),
      TaskReminderOptionId.m15,
      false,
    );
  });
  it('stores event and task details as native notes', async () => {
    const input = {
      title: 'Class',
      notes: '  Room 204\nBring a notebook  ',
      start: '2026-10-30T09:00',
      end: '2026-10-30T10:00',
      reminder: TaskReminderOptionId.m15,
    };
    await service.addEvent(input);
    expect(tasks.addAndSchedule.calls.mostRecent().args[1]?.notes).toBe(
      'Room 204\nBring a notebook',
    );
    await service.addTask(input);
    expect(tasks.addAndSchedule.calls.mostRecent().args[1]?.notes).toBe(
      'Room 204\nBring a notebook',
    );
  });
  it('carries habit details into future occurrences through the repeat config', () => {
    service.addHabit({
      title: 'Read',
      notes: 'Chapter 2',
      time: '20:30',
      weekdays: [1],
      reminder: TaskReminderOptionId.AtStart,
    });
    expect(tasks.add.calls.mostRecent().args[2]?.notes).toBe('Chapter 2');
    expect(repeat.addTaskRepeatCfgToTask.calls.mostRecent().args[2]?.notes).toBe(
      'Chapter 2',
    );
  });
  it('edits and clears task notes without assigning a duration', () => {
    const task = {
      ...DEFAULT_TASK,
      projectId: 'INBOX_PROJECT',
      id: 'call',
      notes: 'Old details',
    };
    expect(
      service.updateTask(task, {
        title: 'Call',
        notes: '',
        start: '2026-10-30T14:00',
        reminder: TaskReminderOptionId.AtStart,
      }),
    ).toBeTrue();
    expect(tasks.update).toHaveBeenCalledWith('call', { title: 'Call', notes: '' });
    expect(tasks.scheduleTask).toHaveBeenCalledWith(
      task,
      new Date('2026-10-30T14:00').getTime(),
      TaskReminderOptionId.AtStart,
      false,
    );
  });
  it('rejects invalid task edits without changing existing notes or schedule', () => {
    expect(
      service.updateTask(
        { ...DEFAULT_TASK, projectId: 'INBOX_PROJECT', id: 'call' },
        {
          title: 'Call',
          notes: '',
          start: 'invalid',
          reminder: TaskReminderOptionId.AtStart,
        },
      ),
    ).toBeFalse();
    expect(tasks.update).not.toHaveBeenCalled();
    expect(tasks.scheduleTask).not.toHaveBeenCalled();
  });
  describe('future recurring entries', () => {
    const config: TaskRepeatCfg = {
      ...DEFAULT_TASK_REPEAT_CFG,
      id: 'class-repeat',
      title: 'Class',
      projectId: 'INBOX_PROJECT',
      startDate: '2099-01-05',
      startTime: '09:00',
      repeatCycle: 'WEEKLY',
      repeatEvery: 2,
      monday: true,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
      defaultEstimate: 5400000,
      notes: 'Room 204',
    };
    beforeEach(() => {
      TestBed.inject(MockStore).overrideSelector(selectActiveTaskRepeatCfgs, [config]);
      TestBed.inject(MockStore).refreshState();
    });
    it('previews alternate weeks with the native recurrence calculation and original notes', () => {
      const entries = service.entriesForDay('2099-01-19', 0);
      expect(entries.length).toBe(1);
      expect(entries[0].notes).toBe('Room 204');
      expect(entries[0].start).toBe(new Date('2099-01-19T09:00').getTime());
      expect(entries[0].end - entries[0].start).toBe(5400000);
      expect(service.entriesForDay('2099-01-12', 0)).toEqual([]);
      expect(tasks.add).not.toHaveBeenCalled();
      expect(tasks.addAndSchedule).not.toHaveBeenCalled();
    });
    it('shows one real occurrence with its end time instead of duplicating a preview', () => {
      TestBed.inject(MockStore).overrideSelector(selectAllTasks, [
        {
          ...DEFAULT_TASK,
          id: 'instance',
          projectId: 'INBOX_PROJECT',
          title: 'Class',
          repeatCfgId: config.id,
          timeEstimate: 5400000,
          dueWithTime: new Date('2099-01-19T09:00').getTime(),
          isDone: true,
        },
      ]);
      TestBed.inject(MockStore).refreshState();
      const entries = service.entriesForDay('2099-01-19', 0);
      expect(entries.length).toBe(1);
      expect(entries[0].task?.id).toBe('instance');
      expect(entries[0].end - entries[0].start).toBe(5400000);
    });
    it('does not preview paused, skipped or past occurrences', () => {
      const store = TestBed.inject(MockStore);
      store.overrideSelector(selectActiveTaskRepeatCfgs, [{ ...config, isPaused: true }]);
      store.refreshState();
      expect(service.entriesForDay('2099-01-19', 0)).toEqual([]);
      store.overrideSelector(selectActiveTaskRepeatCfgs, [
        { ...config, deletedInstanceDates: ['2099-01-19'] },
      ]);
      store.refreshState();
      expect(service.entriesForDay('2099-01-19', 0)).toEqual([]);
      store.overrideSelector(selectActiveTaskRepeatCfgs, [
        { ...config, startDate: '2000-01-03' },
      ]);
      store.refreshState();
      expect(service.entriesForDay('2000-01-17', 0)).toEqual([]);
    });
  });
});
