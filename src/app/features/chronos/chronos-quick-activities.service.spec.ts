import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { ChronosQuickActivitiesService } from './chronos-quick-activities.service';
import { TaskService } from '../tasks/task.service';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { selectAllTasks, selectCurrentTaskId } from '../tasks/store/task.selectors';

const activity: Task = {
  ...DEFAULT_TASK,
  id: 'travel',
  title: 'Travel',
  projectId: 'INBOX_PROJECT',
  isChronosQuickActivity: true,
};

describe('ChronosQuickActivitiesService', () => {
  let service: ChronosQuickActivitiesService;
  let store: MockStore;
  let tasks: jasmine.SpyObj<TaskService>;
  beforeEach(() => {
    tasks = jasmine.createSpyObj<TaskService>('TaskService', [
      'add',
      'setCurrentId',
      'update',
    ]);
    tasks.add.and.returnValue('new');
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [
            {
              selector: selectAllTasks,
              value: [
                activity,
                { ...activity, id: 'normal', isChronosQuickActivity: undefined },
              ],
            },
            { selector: selectCurrentTaskId, value: null },
          ],
        }),
        { provide: TaskService, useValue: tasks },
      ],
    });
    store = TestBed.inject(MockStore);
    service = TestBed.inject(ChronosQuickActivitiesService);
  });
  afterEach(() => store.resetSelectors());
  it('derives buttons from the optional task flag and reuses matching activities', () => {
    expect(service.activities()).toEqual([activity]);
    expect(service.add(' travel ')).toBe('travel');
    expect(tasks.add).not.toHaveBeenCalled();
  });
  it('creates custom activities through ordinary task actions without short syntax', () => {
    expect(service.add('  Train #2  ')).toBe('new');
    expect(tasks.add).toHaveBeenCalledWith(
      'Train #2',
      false,
      { isChronosQuickActivity: true },
      false,
      true,
    );
    expect(service.add('  ')).toBeNull();
  });
  it('starts, stops on a second tap and switches through the one-current-task pointer', () => {
    service.toggle('travel');
    expect(tasks.setCurrentId).toHaveBeenCalledWith('travel');
    store.overrideSelector(selectCurrentTaskId, 'travel');
    store.refreshState();
    service.toggle('travel');
    expect(tasks.setCurrentId).toHaveBeenCalledWith(null);
    service.toggle('other');
    expect(tasks.setCurrentId).toHaveBeenCalledWith('other');
  });
  it('renames and unpins without deleting accumulated task time', () => {
    service.rename(activity, '  Home  ');
    expect(tasks.update).toHaveBeenCalledWith('travel', { title: 'Home' });
    service.unpin(activity);
    expect(tasks.update).toHaveBeenCalledWith('travel', {
      isChronosQuickActivity: false,
    });
  });
  it('keeps a removed starter hidden and reuses its task when pinned again', () => {
    const unpinned = { ...activity, isChronosQuickActivity: false };
    store.overrideSelector(selectAllTasks, [unpinned]);
    store.refreshState();
    expect(service.hiddenStarterNames()).toEqual(['travel']);
    expect(service.add('Travel')).toBe('travel');
    expect(tasks.update).toHaveBeenCalledWith('travel', { isChronosQuickActivity: true });
    expect(tasks.add).not.toHaveBeenCalled();
  });
  it('keeps a starter identity when renamed or unpinned', () => {
    service.rename(activity, 'Home', 'F.CHRONOS.QUICK_TRAVEL');
    expect(tasks.update).toHaveBeenCalledWith('travel', {
      title: 'Home',
      chronosQuickStarterKey: 'F.CHRONOS.QUICK_TRAVEL',
    });
    store.overrideSelector(selectAllTasks, [
      {
        ...activity,
        title: 'Home',
        isChronosQuickActivity: false,
        chronosQuickStarterKey: 'F.CHRONOS.QUICK_TRAVEL',
      },
    ]);
    store.refreshState();
    expect(service.starterKeys()).toContain('F.CHRONOS.QUICK_TRAVEL');
  });
});
