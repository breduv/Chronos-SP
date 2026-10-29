import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
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
  imports: [MatButton, TranslatePipe],
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
  readonly suggestions = computed(() => {
    this._language();
    const configured = new Set([
      ...this.quick.activities().map((task) => task.title.toLocaleLowerCase()),
      ...this.quick.hiddenStarterNames(),
    ]);
    return [
      T.F.CHRONOS.QUICK_TRAVEL,
      T.F.CHRONOS.QUICK_FOOD,
      T.F.CHRONOS.QUICK_STUDY,
      T.F.CHRONOS.QUICK_REST,
    ]
      .map((key) => this._translate.instant(key) as string)
      .filter((title) => !configured.has(title.toLocaleLowerCase()));
  });
  setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }
  add(event: Event): void {
    event.preventDefault();
    if (this.quick.add(this.name())) this.name.set('');
  }
  rename(task: Task, event: Event): void {
    this.quick.rename(task, (event.target as HTMLInputElement).value);
  }
}
