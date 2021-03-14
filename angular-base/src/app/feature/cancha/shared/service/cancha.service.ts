import { Injectable } from '@angular/core';
import { HttpService } from '@core-service/http.service';
import { environment } from 'src/environments/environment';
import {Cancha} from '../model/cancha';
import {Observable} from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class CanchaService {

  constructor(protected http: HttpService) {}

  public consultar(): Observable<Cancha[]> {
    const url = `${environment.endpointCancha}/listar-canchas`;
    console.log(url);
    return this.http.doGet<Cancha[]>(url, this.http.optsName('listar canchas'));
  }

  public guardar(cancha: Cancha) {
    return this.http.doPost<Cancha, boolean>(`${environment.endpointCancha}/registrar-cancha`, cancha,
      this.http.optsName('crear/registrar canchas'));
  }

  public actualizar(cancha: Cancha) {
    return this.http.doPut<Cancha, boolean>(`${environment.endpointCancha}/actualizar-cancha`, cancha,
      this.http.optsName('actualizar/actualizar canchas'));
  }

  public eliminar(cancha: Cancha) {
    return this.http.doDelete<boolean>(`${environment.endpointCancha}/productos/${cancha.id}`,
      this.http.optsName('eliminar productos'));
  }
}
