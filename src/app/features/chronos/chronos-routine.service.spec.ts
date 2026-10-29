import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { ChronosRoutineService } from './chronos-routine.service';
import { TaskService } from '../tasks/task.service';
import { TaskReminderOptionId } from '../tasks/task.model';
import { TaskRepeatCfgService } from '../task-repeat-cfg/task-repeat-cfg.service';
import { DateService } from '../../core/date/date.service';
import { selectAllTaskRepeatCfgs } from '../task-repeat-cfg/store/task-repeat-cfg.selectors';
import { selectAllTasks } from '../tasks/store/task.selectors';

describe('ChronosRoutineService', () => {
  let service: ChronosRoutineService;
  let tasks: jasmine.SpyObj<TaskService>;
  let repeat: jasmine.SpyObj<TaskRepeatCfgService>;
  beforeEach(() => {
    tasks = jasmine.createSpyObj<TaskService>('tasks', [
      'add',
      'addAndSchedule',
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
});
