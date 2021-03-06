import { RequestOptionsArgs } from '@angular/http';
import { Jsonp, URLSearchParams } from '@angular/http';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { Observable, Subscription } from 'rxjs/Rx';

enum Key {
  Backspace = 8,
  Tab = 9,
  Enter = 13,
  Shift = 16,
  Escape = 27,
  ArrowLeft = 37,
  ArrowRight = 39,
  ArrowUp = 38,
  ArrowDown = 40
}

@Component({
  selector: '[typeahead]',
  template: `
  <template #suggestionsTplRef>
  <section class="list-group results" *ngIf="showSuggestions">
    <div class="typeahead-backdrop" (click)="hideSuggestions()"></div>
    <button type="button" class="list-group-item"
      *ngFor="let result of results; let i = index;"
      [class.active]="markIsActive(i, result)"
      (click)="handleSelectSuggestion(result)">
      {{ result }}
    </button>
  </section>
  </template>
  `,
  styleUrls: [`
  .typeahead-backdrop {
    position: fixed;
    bottom: 0;
    top: 0;
    left: 0;
    right: 0;
  }
  `]
})
export class TypeAheadComponent implements OnInit, OnDestroy {
  @Output() typeaheadSelected = new EventEmitter<string>();

  private showSuggestions: boolean = false;
  private results: string[];
  private suggestionIndex: number = 0;
  private subscriptions: Subscription[];
  private activeResult: string;

  @ViewChild('suggestionsTplRef') suggestionsTplRef;

  @HostListener('keydown', ['$event'])
  handleEsc(event: KeyboardEvent) {
    if (event.keyCode === Key.Escape) {
      this.hideSuggestions();
      event.preventDefault();
    }
  }

  constructor(private element: ElementRef,
    private viewContainer: ViewContainerRef,
    private jsonp: Jsonp,
    private cdr: ChangeDetectorRef,
    private zone: NgZone) { }

  ngOnInit() {
    this.subscriptions = [
      this.filterEnterEvent(),
      this.listenAndSuggest(),
      this.navigateWithArrows()
    ];
    this.renderTemplate();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.length = 0;
  }

  renderTemplate() {
    this.viewContainer.createEmbeddedView(this.suggestionsTplRef);
    this.cdr.markForCheck();
  }

  filterEnterEvent() {
    return Observable.fromEvent(this.element.nativeElement, 'keydown')
      .filter((e: KeyboardEvent) => e.keyCode === Key.Enter)
      .subscribe((event: Event) => {
        event.preventDefault();
        this.handleSelectSuggestion(this.activeResult);
      });
  }

  listenAndSuggest() {
    return Observable.fromEvent(this.element.nativeElement, 'keyup')
      .filter(this.validateKeyCode)
      .map((e: any) => e.target.value)
      .debounceTime(400)
      .concat()
      .distinctUntilChanged()
      .switchMap((query: string) => this.suggest(query))
      .subscribe((results: string[]) => {
        this.results = results;
        this.showSuggestions = true;
        this.cdr.markForCheck();
    });
  }

  navigateWithArrows() {
    return Observable.fromEvent(this.element.nativeElement, 'keydown')
      .filter((e: any) => e.keyCode === Key.ArrowDown || e.keyCode === Key.ArrowUp)
      .map((e: any) => e.keyCode)
      .subscribe((keyCode: number) => {
        let step = keyCode === Key.ArrowDown ? 1 : -1;
        const topLimit = 9;
        const bottomLimit = 0;
        this.suggestionIndex += step;
        if (this.suggestionIndex === topLimit + 1) {
          this.suggestionIndex = bottomLimit;
        }
        if (this.suggestionIndex === bottomLimit - 1) {
          this.suggestionIndex = topLimit;
        }
        this.showSuggestions = true;
        // this.renderTemplate();
        this.cdr.markForCheck();
      });
  }
  suggest(query: string) {
    const url = 'http://suggestqueries.google.com/complete/search';
    const searchConfig: URLSearchParams = new URLSearchParams();
    const searchParams = {
      hl: 'en',
      ds: 'yt',
      xhr: 't',
      client: 'youtube',
      q: query,
      callback: 'JSONP_CALLBACK'
    };
    Object.keys(searchParams).forEach(param => searchConfig.set(param, searchParams[param]));
    const options: RequestOptionsArgs = {
      search: searchConfig
    };
    return this.jsonp.get(url, options)
      .map(response => response.json()[1])
      .map(results => results.map(result => result[0]));
  }

  markIsActive(index: number, result: string) {
    const isActive = index === this.suggestionIndex;
    if (isActive) {
      this.activeResult = result;
    }
    return isActive;
  }
  handleSelectSuggestion(suggestion: string) {
    this.hideSuggestions();
    this.typeaheadSelected.emit(suggestion);
  }

  validateKeyCode(event: KeyboardEvent) {
    return event.keyCode !== Key.Tab
     && event.keyCode !== Key.Shift
     && event.keyCode !== Key.ArrowLeft
     && event.keyCode !== Key.ArrowUp
     && event.keyCode !== Key.ArrowRight
     && event.keyCode !== Key.ArrowDown;
  }

  hideSuggestions() {
    this.showSuggestions = false;
  }
}
