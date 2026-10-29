import { Injectable, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { TaskService } from '../tasks/task.service';
import { Task } from '../tasks/task.model';
import { selectAllTasks, selectCurrentTaskId } from '../tasks/store/task.selectors';

@Injectable({ providedIn: 'root' })
export class ChronosQuickActivitiesService {
  private readonly _store = inject(Store);
  private readonly _tasks = inject(TaskService);
  private readonly _all = this._store.selectSignal(selectAllTasks);
  readonly currentId = this._store.selectSignal(selectCurrentTaskId);
  readonly activities = computed(() =>
    this._all().filter((task) => task.isChronosQuickActivity && !task.parentId),
  );

  readonly hiddenStarterNames = computed(() =>
    this._all()
      .filter((task) => task.isChronosQuickActivity === false)
      .map((task) => task.title.toLocaleLowerCase()),
  );

  add(title: string): string | null {
    const name = title.trim();
    if (!name) return null;
    const existing = this.activities().find(
      (task) => task.title.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (existing) return existing.id;
    const unpinned = this._all().find(
      (task) =>
        !task.parentId &&
        task.isChronosQuickActivity === false &&
        task.title.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (unpinned) {
      this._tasks.update(unpinned.id, { isChronosQuickActivity: true });
      return unpinned.id;
    }
    return this._tasks.add(name, false, { isChronosQuickActivity: true }, false, true);
  }
  startSuggested(title: string): void {
    const id = this.add(title);
    if (id) this.toggle(id);
  }
  toggle(id: string): void {
    this._tasks.setCurrentId(this.currentId() === id ? null : id);
  }
  rename(task: Task, title: string): void {
    const name = title.trim();
    if (name && name !== task.title) this._tasks.update(task.id, { title: name });
  }
  unpin(task: Task): void {
    this._tasks.update(task.id, { isChronosQuickActivity: false });
  }
}
