import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { ListarReservaComponent } from './listar-reserva.component';
import {CommonModule} from '@angular/common';
import {HttpClientModule} from '@angular/common/http';
import {RouterTestingModule} from '@angular/router/testing';
import {HttpService} from '@core-service/http.service';
import {ReservaService} from '../../shared/service/reserva.service';
import {Reserva} from '../../shared/model/reserva';
import {of} from 'rxjs';

describe('ListarReservaComponent', () => {
  let component: ListarReservaComponent;
  let fixture: ComponentFixture<ListarReservaComponent>;
  let reservaService: ReservaService;
  const listaReservas: Reserva[] = [new Reserva( 1, 1, 'ACTIVO', '2021-03-14', '20:00', 'Prueba', 10000, 0)];

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ListarReservaComponent ],
      imports: [
        CommonModule,
        HttpClientModule,
        RouterTestingModule
      ],
      providers: [ReservaService, HttpService]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ListarReservaComponent);
    component = fixture.componentInstance;
    reservaService = TestBed.inject(ReservaService);
    spyOn(reservaService, 'consultar').and.returnValue(
      of(listaReservas)
    );
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('listar', () => {
    expect(component).toBeTruthy();
    expect(1).toBe(component.reservas.length);
  });
});
