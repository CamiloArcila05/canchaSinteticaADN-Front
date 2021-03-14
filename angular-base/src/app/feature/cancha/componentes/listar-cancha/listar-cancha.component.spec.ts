import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ListarCanchaComponent } from './listar-cancha.component';
import {CommonModule} from "@angular/common";
import {HttpClientModule} from "@angular/common/http";
import {RouterTestingModule} from "@angular/router/testing";
import {HttpService} from "@core-service/http.service";
import {CanchaService} from "../../shared/service/cancha.service";
import {Cancha} from "../../shared/model/cancha";
import {of} from "rxjs";

describe('ListarCanchaComponent', () => {
  let component: ListarCanchaComponent;
  let fixture: ComponentFixture<ListarCanchaComponent>;
  let canchaService: CanchaService;
  const listaCanchas: Cancha[] = [new Cancha( 1, 'Cancha 1', 'Cancha 1', 'ACTIVO', 10000, 10000)];

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ListarCanchaComponent ],
      imports: [
        CommonModule,
        HttpClientModule,
        RouterTestingModule
      ],
      providers: [CanchaService, HttpService]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ListarCanchaComponent);
    component = fixture.componentInstance;
    canchaService = TestBed.inject(CanchaService);
    spyOn(canchaService, 'consultar').and.returnValue(
      of(listaCanchas)
    );
    fixture.detectChanges();
  });


  it('should create', () => {
    expect(component).toBeTruthy();
  });


  it('listar', () => {
    expect(component).toBeTruthy();
    expect(1).toBe(component.canchas.length);
  });
});
