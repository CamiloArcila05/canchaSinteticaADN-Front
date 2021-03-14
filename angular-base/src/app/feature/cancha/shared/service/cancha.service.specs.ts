import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {environment} from '../../../../../environments/environment';
import {CanchaService} from './cancha.service';
import {TestBed} from '@angular/core/testing';
import {HttpService} from '@core-service/http.service';
import {HttpResponse} from '@angular/common/http';
import {Cancha} from '../model/cancha';


describe('CanchaService', () => {

  let httpMock: HttpTestingController;
  let service: CanchaService;
  const apiEndpointCrearCancha = `${environment.endpointCancha}/registrar-cancha`;
  const apiEndpointConsultarCanchas = `${environment.endpointCancha}/listar-canchas`;
  const apiEndpointActualizarCancha = `${environment.endpointCancha}/actualizar-cancha`;


  beforeEach(() => {
    const injector = TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CanchaService, HttpService]
    });
    httpMock = injector.inject(HttpTestingController);
    service = TestBed.inject(CanchaService);
  });

  it('should be created', () => {
    const canchaService: CanchaService = TestBed.inject(CanchaService);
    expect(canchaService).toBeTruthy();
  });


  it('deberia listar canchas', () => {
    const dummyCanchas = [
      new Cancha( 1, 'Cancha 1', 'Cancha 1', 'ACTIVO', 10000, 10000),
      new Cancha( 1, 'Cancha 1', 'Cancha 1', 'ACTIVO', 10000, 10000)
    ];
    service.consultar().subscribe(canchas => {
      expect(canchas.length).toBe(2);
      expect(canchas).toEqual(dummyCanchas);
    });
    const req = httpMock.expectOne(apiEndpointConsultarCanchas);
    expect(req.request.method).toBe('GET');
    req.flush(dummyCanchas);
  });


  it('deberia crear una Cancha', () => {
    const dummyCancha = new Cancha( 1, 'Cancha 1', 'Cancha 1', 'ACTIVO', 10000, 10000);
    service.guardar(dummyCancha).subscribe((respuesta) => {
      expect(respuesta).toEqual(true);
    });
    const req = httpMock.expectOne(apiEndpointCrearCancha);
    expect(req.request.method).toBe('POST');
    req.event(new HttpResponse<boolean>({body: true}));
  });

  it('deberia actualizar una Cancha', () => {
    const dummyCancha = new Cancha( 1, 'Cancha 1', 'Cancha 1', 'ACTIVO', 10000, 10000);
    service.actualizar(dummyCancha).subscribe((respuesta) => {
      expect(respuesta).toEqual(true);
    });
    const req = httpMock.expectOne(apiEndpointActualizarCancha);
    expect(req.request.method).toBe('PUT');
    req.event(new HttpResponse<boolean>({body: true}));
  });

});
