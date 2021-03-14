import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {environment} from '../../../../../environments/environment';
import {TestBed} from '@angular/core/testing';
import {HttpService} from '@core-service/http.service';
import {HttpResponse} from '@angular/common/http';
import {ReservaService} from "./reserva.service";
import {Reserva} from "../model/reserva";


describe('CanchaService', () => {

  let httpMock: HttpTestingController;
  let service: ReservaService;
  const apiEndpointCrearReserva = `${environment.endpointReserva}/registrar-reserva`;
  const apiEndpointConsultarReservas = `${environment.endpointReserva}/listar-reserva`;
  const apiEndpointCancelarCancha = `${environment.endpointReserva}/cancelar-reserva`;
  const apiEndpointFinalizarCancha = `${environment.endpointReserva}/finalizar-reserva`;


  beforeEach(() => {
    const injector = TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReservaService, HttpService]
    });
    httpMock = injector.inject(HttpTestingController);
    service = TestBed.inject(ReservaService);
  });

  it('should be created', () => {
    const reservaService: ReservaService = TestBed.inject(ReservaService);
    expect(reservaService).toBeTruthy();
  });


  it('deberia listar reservas', () => {
    const dummyReservas = [
      new Reserva( 1, 1, 'ACTIVO', '2021-03-14', '20:00', 'Prueba', 10000, 0),
      new Reserva( 1, 1, 'ACTIVO', '2021-03-14', '20:00', 'Prueba', 10000, 0)
    ];
    service.consultar().subscribe(reservas => {
      expect(reservas.length).toBe(2);
      expect(reservas).toEqual(dummyReservas);
    });
    const req = httpMock.expectOne(apiEndpointConsultarReservas);
    expect(req.request.method).toBe('GET');
    req.flush(dummyReservas);
  });


  it('deberia crear una Reserva', () => {
    const dummyCancha = new Reserva( 1, 1, 'ACTIVO', '2021-03-14', '20:00', 'Prueba', 10000, 0);
    service.guardar(dummyCancha).subscribe((respuesta) => {
      expect(respuesta).toEqual(true);
    });
    const req = httpMock.expectOne(apiEndpointCrearReserva);
    expect(req.request.method).toBe('POST');
    req.event(new HttpResponse<boolean>({body: true}));
  });

  it('deberia cancelar una Cancha', () => {
    service.cancelar(1).subscribe((respuesta) => {
      expect(respuesta).toEqual(true);
    });
    const req = httpMock.expectOne(apiEndpointCancelarCancha);
    expect(req.request.method).toBe('PUT');
    req.event(new HttpResponse<boolean>({body: true}));
  });

  it('deberia finalizar una Cancha', () => {
    service.finalizar(1, 10000).subscribe((respuesta) => {
      expect(respuesta).toEqual(true);
    });
    const req = httpMock.expectOne(apiEndpointFinalizarCancha);
    expect(req.request.method).toBe('PUT');
    req.event(new HttpResponse<boolean>({body: true}));
  });

});
