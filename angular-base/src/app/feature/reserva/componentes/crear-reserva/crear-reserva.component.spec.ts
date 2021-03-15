import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearReservaComponent } from './crear-reserva.component';
import {CommonModule, DatePipe} from '@angular/common';
import {HttpClientModule} from '@angular/common/http';
import {RouterTestingModule} from '@angular/router/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ToastrModule} from 'ngx-toastr';
import {HttpService} from '@core-service/http.service';
import {ReservaService} from '../../shared/service/reserva.service';
import {of} from 'rxjs';

describe('CrearReservaComponent', () => {
  let component: CrearReservaComponent;
  let fixture: ComponentFixture<CrearReservaComponent>;
  let reservaService: ReservaService;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CrearReservaComponent ],
      imports: [
        CommonModule,
        HttpClientModule,
        RouterTestingModule,
        ReactiveFormsModule,
        FormsModule,
        ToastrModule.forRoot()
      ],
      providers: [ReservaService, HttpService, DatePipe],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CrearReservaComponent);
    component = fixture.componentInstance;
    reservaService = TestBed.inject(ReservaService);
    spyOn(reservaService, 'guardar').and.returnValue(
      of(true)
    );
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formulario es invalido cuando esta vacio', () => {
    expect(component.reservaForm.valid).toBeFalsy();
  });

  it('Registrando Reserva', () => {
    expect(component.reservaForm.valid).toBeFalsy();
    component.reservaForm.controls.nombreSolicita.setValue('Prueba');
    component.reservaForm.controls.canchaId.setValue(1);
    component.reservaForm.controls.fecha.setValue('2021-30-12');
    component.reservaForm.controls.hora.setValue('20:00');
    component.reservaForm.controls.valorAbono.setValue(1);
    expect(component.reservaForm.valid).toBeTruthy();
    component.crearReserva();
  });
});
