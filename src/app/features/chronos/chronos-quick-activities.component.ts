import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { T } from '../../t.const';
import { Task } from '../tasks/task.model';
import { ChronosQuickActivitiesService } from './chronos-quick-activities.service';

@Component({
  selector: 'chronos-quick-activities',
  templateUrl: './chronos-quick-activities.component.html',
  styleUrl: './chronos-quick-activities.component.scss',
  imports: [MatButton, TranslatePipe, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChronosQuickActivitiesComponent {
  private readonly _translate = inject(TranslateService);
  private readonly _language = toSignal(
    this._translate.onLangChange.pipe(startWith(null)),
  );
  readonly quick = inject(ChronosQuickActivitiesService);
  readonly T = T;
  readonly name = signal('');
  readonly managing = signal(false);
  readonly starters = computed(() => {
    this._language();
    return [
      T.F.CHRONOS.QUICK_TRAVEL,
      T.F.CHRONOS.QUICK_FOOD,
      T.F.CHRONOS.QUICK_STUDY,
      T.F.CHRONOS.QUICK_REST,
    ].map((key) => ({ key, title: this._translate.instant(key) as string }));
  });
  readonly suggestions = computed(() => {
    this._language();
    const configured = new Set([
      ...this.quick.activities().map((task) => task.title.toLocaleLowerCase()),
      ...this.quick.hiddenStarterNames(),
    ]);
    return this.starters().filter(
      ({ key, title }) =>
        !this.quick.starterKeys().includes(key) &&
        !configured.has(title.toLocaleLowerCase()),
    );
  });
  manage(): void {
    if (!this.managing()) {
      for (const starter of this.suggestions())
        this.quick.add(starter.title, starter.key);
    }
    this.managing.update((value) => !value);
  }
  setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }
  add(event: Event): void {
    event.preventDefault();
    if (this.quick.add(this.name())) this.name.set('');
  }
  rename(task: Task, event: Event): void {
    const key =
      task.chronosQuickStarterKey ||
      this.starters().find(
        (item) => item.title.toLocaleLowerCase() === task.title.toLocaleLowerCase(),
      )?.key;
    this.quick.rename(task, (event.target as HTMLInputElement).value, key);
  }
}
