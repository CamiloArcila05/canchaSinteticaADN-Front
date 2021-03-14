import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CanchaComponent } from './cancha.component';
import {CommonModule} from "@angular/common";
import {HttpClientModule} from "@angular/common/http";
import {RouterTestingModule} from "@angular/router/testing";

describe('CanchaComponent', () => {
  let component: CanchaComponent;
  let fixture: ComponentFixture<CanchaComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CanchaComponent ],
      imports: [
        CommonModule,
        HttpClientModule,
        RouterTestingModule
      ],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CanchaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
