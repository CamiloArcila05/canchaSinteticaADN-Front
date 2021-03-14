import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CancelarReservaComponent } from './cancelar-reserva.component';
import {CommonModule} from "@angular/common";
import {HttpClientModule} from "@angular/common/http";
import {RouterTestingModule} from "@angular/router/testing";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {ToastrModule} from "ngx-toastr";
import {ReservaService} from "../../shared/service/reserva.service";
import {HttpService} from "@core-service/http.service";
import {of} from "rxjs";
import {Reserva} from "../../shared/model/reserva";

describe('CancelarReservaComponent', () => {
  let component: CancelarReservaComponent;
  let fixture: ComponentFixture<CancelarReservaComponent>;
  let reservaService: ReservaService;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CancelarReservaComponent ],
      imports: [
        CommonModule,
        HttpClientModule,
        RouterTestingModule,
        ReactiveFormsModule,
        FormsModule,
        ToastrModule.forRoot()
      ],
      providers: [ReservaService, HttpService],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CancelarReservaComponent);
    component = fixture.componentInstance;
    reservaService = TestBed.inject(ReservaService);
    spyOn(reservaService, 'cancelar').and.returnValue(
      of(true)
    );
    localStorage.setItem('reservaSeleccionada', JSON.stringify(
      new Reserva( 1, 1, 'ACTIVO', '2021-03-14', '20:00', 'Prueba', 10000, 0)));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
