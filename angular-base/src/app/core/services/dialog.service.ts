import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {CrearCanchaComponent} from '../../feature/cancha/componentes/crear-cancha/crear-cancha.component';

@Injectable({
  providedIn: 'root'
})
export class DialogService {

  defaultOptions = {
    disableClose: true
  };

  constructor(
    private matDialog: MatDialog
  ) {
  }

  assignOptions(newInformation) {
    return Object.assign({}, this.defaultOptions, newInformation);
  }

  showModalCrearCancha() {
    let dialogRef: MatDialogRef<CrearCanchaComponent>;
    dialogRef = this.matDialog.open(CrearCanchaComponent, this.defaultOptions);
    return dialogRef.afterClosed();
  }

}
